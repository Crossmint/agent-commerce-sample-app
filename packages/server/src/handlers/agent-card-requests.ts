import type { AuthenticatedUser } from "@agent-commerce/auth";
import {
  expiresInHours,
  isReadyForAgent,
  pendingVerificationRails,
  withAgentRails,
} from "@agent-commerce/core";
import { parseBody, requireUser, type Ctx, resolveEmail } from "../context.js";
import { forbidden, HttpError, invalidRequest, json, notFound } from "../errors.js";
import { agentCardRequestId } from "../ids.js";
import type { Params } from "../router.js";
import { approveSchema, createRequestSchema } from "../schemas.js";
import type { AgentCardRequest, NewAgentCardRequest } from "../types.js";

/** POST /v1/agent-card-requests */
export async function createRequest(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, createRequestSchema);
  const now = ctx.now();
  const id = agentCardRequestId();
  const row: NewAgentCardRequest = {
    id,
    userId: user.userId,
    requester: body.requester ?? ctx.defaultRequester,
    amount: body.amount,
    description: body.description,
    expiresAt: expiresInHours(body.expiresInHours ?? 24, now),
    requestExpiresAt: new Date(now.getTime() + ctx.requestTtlMinutes * 60_000).toISOString(),
    status: "pending",
    approvalUrl: `${ctx.config.webBaseUrl.replace(/\/$/, "")}/approve/${id}`,
  };
  if (body.merchant) row.merchant = body.merchant;
  const created = await ctx.store.create(row);
  return json(created, 201);
}

/** GET /v1/agent-card-requests/:id */
export async function getRequest(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const request = await loadOwnedRequest(ctx, user, params.id!);
  return json(await reconcileRequest(ctx, user, request));
}

/**
 * Settle an `approved` request against Crossmint.
 *
 * An approved card may have been verified somewhere other than the approval
 * page — the wallet list, or a checkout's payment step — so the stored status
 * can lag behind the card. Checking here is what lets a polling agent see the
 * request turn active. Anything else is returned untouched.
 */
export async function reconcileRequest(
  ctx: Ctx,
  user: AuthenticatedUser,
  request: AgentCardRequest,
): Promise<AgentCardRequest> {
  if (request.status !== "approved" || !request.agentCardId) return request;
  try {
    const agentCard = await ctx.crossmint.orderIntents.get({ jwt: user.jwt }, request.agentCardId);
    if (agentCard.status !== "active") {
      return ctx.store.update(request.id, {
        status: "failed",
        failureReason: `agent card ${agentCard.status}`,
      });
    }
    if (isReadyForAgent(agentCard)) return ctx.store.update(request.id, { status: "active" });
  } catch (e) {
    console.warn(
      "[agent-commerce] could not reconcile request",
      request.id,
      e instanceof Error ? e.message : e,
    );
  }
  return request;
}

/**
 * POST /v1/agent-card-requests/:id/approve
 *
 * Also answers a second time while the request is `approved`: the card is
 * made but not usable yet, so verification may have failed and the user may
 * be trying another card. The card from the first answer is revoked, because
 * nothing may be left behind that an agent could still spend from.
 */
export async function approveRequest(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, approveSchema);
  const request = await loadOwnedRequest(ctx, user, params.id!);
  assertAnswerable(request);

  const email = await resolveEmail(user, ctx, body.email);
  const jwt = { jwt: user.jwt };

  await revokePreviousCard(ctx, jwt, request);

  // Idempotent. Turns on the network rails the card supports.
  await ctx.crossmint.paymentMethods.registerForOrderIntents(jwt, body.paymentMethodId, {
    email,
    countryCode: body.countryCode ?? "US",
  });

  const agentCard = await ctx.crossmint.orderIntents.create(jwt, {
    paymentMethodId: body.paymentMethodId,
    amount: request.amount,
    description: request.description,
    expiresAt: request.expiresAt,
    ...(request.merchant ? { merchant: request.merchant } : {}),
  });

  // Active means an agent can pay with it: a card rail is live, or nothing is left to verify.
  const active = isReadyForAgent(agentCard);
  const updated = await ctx.store.update(request.id, {
    status: active ? "active" : "approved",
    agentCardId: agentCard.orderIntentId,
    paymentMethodId: body.paymentMethodId,
  });
  const needsVerification = pendingVerificationRails(agentCard).length > 0;
  return json({ request: updated, agentCard: withAgentRails(agentCard), needsVerification });
}

/** POST /v1/agent-card-requests/:id/verified */
export async function verifiedRequest(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const request = await loadOwnedRequest(ctx, user, params.id!);
  if (!request.agentCardId) {
    throw new HttpError(409, "invalid_request", "This request has no agent card yet");
  }
  const agentCard = await ctx.crossmint.orderIntents.get({ jwt: user.jwt }, request.agentCardId);

  let updated: AgentCardRequest = request;
  if (agentCard.status !== "active") {
    updated = await ctx.store.update(request.id, {
      status: "failed",
      failureReason: `Agent card is ${agentCard.status}`,
    });
  } else if (isReadyForAgent(agentCard) && request.status !== "active") {
    updated = await ctx.store.update(request.id, { status: "active" });
  }
  return json({ request: updated, agentCard: withAgentRails(agentCard) });
}

/**
 * POST /v1/agent-card-requests/:id/deny
 *
 * Denying an `approved` request is a change of mind partway through, so the
 * card made on the way is revoked with it.
 */
export async function denyRequest(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const request = await loadOwnedRequest(ctx, user, params.id!);
  assertAnswerable(request);
  await revokePreviousCard(ctx, { jwt: user.jwt }, request);
  // The revoked card id stays on the record: it says what was undone.
  const updated = await ctx.store.update(request.id, { status: "denied" });
  return json(updated);
}

// ---------------------------------------------------------------------------

/** Load a request, check ownership, and expire it when the answer window has passed. */
async function loadOwnedRequest(
  ctx: Ctx,
  user: AuthenticatedUser,
  id: string,
): Promise<AgentCardRequest> {
  const request = await ctx.store.get(id);
  if (!request) throw notFound(`Agent card request ${id} not found`);
  if (request.userId !== user.userId) throw forbidden();
  if (request.status === "pending" && Date.parse(request.requestExpiresAt) <= ctx.now().getTime()) {
    return ctx.store.update(id, { status: "expired" });
  }
  return request;
}

/**
 * The request can still be answered: nobody has answered it yet, or the
 * answer did not carry — `approved` means a card exists but no agent can
 * spend from it until verification lands.
 */
function assertAnswerable(request: AgentCardRequest): void {
  if (request.status === "pending" || request.status === "approved") return;
  if (request.status === "expired") {
    throw new HttpError(409, "expired", "The user did not answer this request in time");
  }
  throw new HttpError(409, "invalid_request", `This request is already ${request.status}`);
}

/**
 * Drop the agent card left by an earlier answer. Best effort: a card that
 * Crossmint will not revoke must not block the new one, and an unverified
 * card can spend nothing in the meantime. It is logged, never raised.
 */
async function revokePreviousCard(
  ctx: Ctx,
  jwt: { jwt: string },
  request: AgentCardRequest,
): Promise<void> {
  if (!request.agentCardId) return;
  try {
    await ctx.crossmint.orderIntents.revoke(jwt, request.agentCardId);
  } catch (e) {
    console.warn(
      "[agent-commerce] could not revoke the previous agent card",
      request.agentCardId,
      e instanceof Error ? e.message : e,
    );
  }
}
