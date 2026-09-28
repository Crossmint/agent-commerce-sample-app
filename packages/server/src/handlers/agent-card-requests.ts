import type { AuthenticatedUser } from "@agent-commerce/auth";
import { expiresInHours, isReadyForAgent } from "@agent-commerce/core";
import { parseBody, requireUser, type Ctx } from "../context.js";
import { forbidden, HttpError, json, notFound } from "../errors.js";
import { agentCardRequestId } from "../ids.js";
import type { Params } from "../router.js";
import { authorizedSchema, createRequestSchema } from "../schemas.js";
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

/** POST /v1/agent-card-requests/:id/authorized. The SDK already created and verified it. */
export async function authorizedRequest(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const { orderIntentId } = await parseBody(req, authorizedSchema);
  const request = await loadOwnedRequest(ctx, user, params.id!);
  // A retry after a lost response must not recreate or revalidate a now-spent authorization.
  if (request.status === "active" && request.agentCardId === orderIntentId)
    return json({ request });
  if (request.status !== "pending")
    throw new HttpError(409, "invalid_request", `This request is already ${request.status}`);
  if (!request.merchant)
    throw new HttpError(
      409,
      "merchant_required",
      "Request a new authorization for a specific merchant",
    );

  // Ownership is established by this JWT-scoped read, never by the browser callback.
  const card = await ctx.crossmint.orderIntents.get({ jwt: user.jwt }, orderIntentId);
  const expires = Date.parse(card.expiresAt);
  const sameAmount = decimalEqual(card.amount.total, request.amount.value);
  const sameMerchant =
    card.merchant &&
    new URL(card.merchant.url).origin === new URL(request.merchant.url).origin &&
    card.merchant.countryCode.toUpperCase() === request.merchant.countryCode.toUpperCase();
  if (
    card.status !== "active" ||
    !isReadyForAgent(card) ||
    !Number.isFinite(expires) ||
    expires <= ctx.now().getTime() ||
    expires !== Date.parse(request.expiresAt) ||
    !sameAmount ||
    !decimalEqual(card.amount.available, request.amount.value) ||
    card.amount.currency.toUpperCase() !== request.amount.currency.toUpperCase() ||
    !sameMerchant ||
    card.description !== request.description
  ) {
    throw new HttpError(
      409,
      "agent_card_unusable",
      "The authorization does not match this request or is not ready",
    );
  }
  // Crossmint reads can take time. Recheck expiry, then atomically win against denial/other callbacks.
  if (Date.parse(request.requestExpiresAt) <= ctx.now().getTime()) {
    await ctx.store.transition(request.id, ["pending"], { status: "expired" });
    throw new HttpError(409, "expired", "This request expired before authorization completed");
  }
  const updated = await ctx.store.transition(request.id, ["pending"], {
    status: "active",
    agentCardId: orderIntentId,
    paymentMethodId: card.paymentMethodId,
  });
  if (!updated) {
    const latest = await ctx.store.get(request.id);
    if (latest?.status === "active" && latest.agentCardId === orderIntentId)
      return json({ request: latest });
    throw new HttpError(409, "invalid_request", "This request has already been answered");
  }
  console.info("[sdk-evaluation] authorization.attached", { requestId: request.id, orderIntentId });
  return json({ request: updated });
}

/** Decimal comparison without floating-point rounding or accepting malformed values. */
function decimalEqual(a: string, b: string): boolean {
  const normalize = (value: string) => {
    if (!/^\d+(\.\d+)?$/.test(value)) return undefined;
    const [whole, fraction = ""] = value.split(".");
    return `${BigInt(whole!)}.${fraction.replace(/0+$/, "")}`;
  };
  const left = normalize(a);
  return left !== undefined && left === normalize(b);
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
  const updated = await ctx.store.transition(request.id, ["pending", "approved"], {
    status: "denied",
  });
  if (!updated)
    throw new HttpError(409, "invalid_request", "This request has already been answered");
  await revokePreviousCard(ctx, { jwt: user.jwt }, request);
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
    return (
      (await ctx.store.transition(id, ["pending"], { status: "expired" })) ??
      (await ctx.store.get(id))!
    );
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
