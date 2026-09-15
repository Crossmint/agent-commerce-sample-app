import type { AuthenticatedUser } from "@goat-wallet/auth";
import { expiresInHours, isReadyForAgent, pendingVerificationRails, withAgentRails } from "@goat-wallet/core";
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
  let request = await loadOwnedRequest(ctx, user, params.id!);
  // An "approved" card may have been verified from the wallet list rather than the
  // approval page. Check Crossmint so a polling agent sees it turn active.
  if (request.status === "approved" && request.agentCardId) {
    try {
      const agentCard = await ctx.crossmint.orderIntents.get({ jwt: user.jwt }, request.agentCardId);
      if (agentCard.status !== "active") {
        request = await ctx.store.update(request.id, { status: "failed", failureReason: `agent card ${agentCard.status}` });
      } else if (isReadyForAgent(agentCard)) {
        request = await ctx.store.update(request.id, { status: "active" });
      }
    } catch (e) {
      console.warn("[goat] could not reconcile request", request.id, e instanceof Error ? e.message : e);
    }
  }
  return json(request);
}

/** POST /v1/agent-card-requests/:id/approve */
export async function approveRequest(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, approveSchema);
  const request = await loadOwnedRequest(ctx, user, params.id!);
  assertPending(request);

  const email = await resolveEmail(user, ctx, body.email);
  const jwt = { jwt: user.jwt };

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

/** POST /v1/agent-card-requests/:id/deny */
export async function denyRequest(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const request = await loadOwnedRequest(ctx, user, params.id!);
  assertPending(request);
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

function assertPending(request: AgentCardRequest): void {
  if (request.status === "pending") return;
  if (request.status === "expired") {
    throw new HttpError(409, "expired", "The user did not answer this request in time");
  }
  throw new HttpError(409, "invalid_request", `This request is already ${request.status}`);
}
