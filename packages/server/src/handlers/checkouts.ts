import type { AuthenticatedUser } from "@goat-wallet/auth";
import {
  alternativeResponse,
  declineResponse,
  fillPaymentAction,
  isPaymentAction,
  isTerminalCheckout,
  newMessageId,
  pendingActionOf,
  receiptOf,
  renderPendingAction,
  submitResponse,
  type Amount,
  type Checkout,
  type CheckoutContext,
  type CheckoutMessageList,
  type CheckoutReceipt,
  type CheckoutResult,
  type CheckoutStatus,
  type Merchant,
  type OrderIntent,
  type OutboundMessagePart,
  type PendingUserAction,
  type RenderedAction,
} from "@goat-wallet/core";
import { parseBody, requireUser, type Ctx } from "../context.js";
import { mintFromAgentCard } from "../credentials.js";
import { forbidden, HttpError, json } from "../errors.js";
import type { Params } from "../router.js";
import { buyerProfileSchema, checkoutMessageSchema, createCheckoutSchema, submitActionSchema } from "../schemas.js";

const CROSSMINT_WEB = "https://www.crossmint.com";

/** After answering payment, refetch this many times, this far apart, for the run to consume the answer. */
const SETTLE_POLLS = 2;
const SETTLE_WAIT_MS = 1200;

/**
 * What GOAT returns for a checkout. A flat view of Crossmint's run: the open
 * question (never a payment one), the live browser, and the outcome.
 */
export interface CheckoutView {
  /** Crossmint's `runId`. */
  id: string;
  status: CheckoutStatus;
  agentCardId?: string;
  /** The open input request. `id` is the requestId to answer. Payment requests never appear: the server answers them. */
  pendingUserAction?: PendingUserAction;
  rendered?: RenderedAction;
  /** Absolute URL for a view-only iframe of the agent's browser. */
  embedUrl?: string;
  /** On `succeeded`, `blocked` and `cancelled`: outcome, summary, purchase or code. */
  result?: CheckoutResult;
  /** The receipt of a `succeeded` run, when the agent captured one. */
  receipt?: CheckoutReceipt;
  /** On `failed` (Crossmint's `reason`), `blocked` (the `code`) and `cancelled`. */
  failure?: { reason: string; message?: string };
  /** What the run has spent so far, in USD. */
  spentUsd?: string;
  createdAt?: string;
}

/** Server key + user id when we have a server key. Else the user's JWT. */
function checkoutContext(ctx: Ctx, user: AuthenticatedUser): CheckoutContext {
  return ctx.config.crossmint.serverApiKey ? { userId: user.userId } : { jwt: user.jwt };
}

/** POST /v1/checkouts */
export async function createCheckout(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, createCheckoutSchema);
  const cctx = checkoutContext(ctx, user);
  const task = body.task ?? body.request;
  const checkout = await ctx.crossmint.checkouts.create(cctx, {
    request: { startUrl: (body.startUrl ?? body.url)!, ...(task ? { task } : {}) },
    constraints: { maxCost: body.maxCost },
    ...(body.buyerProfileId ? { buyerProfileId: body.buyerProfileId } : {}),
    ...(body.browserProfileId ? { browserProfileId: body.browserProfileId } : {}),
    ...(body.merchantGuidance ? { merchantGuidance: body.merchantGuidance } : {}),
  });
  await ctx.checkouts.linkCheckout(checkout.runId, user.userId, body.agentCardId);
  const view = await settlePayment(ctx, user, cctx, checkout, body.agentCardId);
  return json(view, 201);
}

/** GET /v1/checkouts/:id */
export async function getCheckout(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const agentCardId = await ownedAgentCardId(ctx, user, params.id!);
  const cctx = checkoutContext(ctx, user);
  const checkout = await ctx.crossmint.checkouts.get(cctx, params.id!);
  return json(await settlePayment(ctx, user, cctx, checkout, agentCardId));
}

/** GET /v1/checkouts/:id/messages?cursor&limit */
export async function listCheckoutMessages(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  await ownedAgentCardId(ctx, user, params.id!);
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit");
  const list: CheckoutMessageList = await ctx.crossmint.checkouts.listMessages(checkoutContext(ctx, user), params.id!, {
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: limit ? Number(limit) : undefined,
  });
  return json(list);
}

/**
 * POST /v1/checkouts/:id/messages
 * Answer the open input request, or send the agent a note. Card fields are
 * refused: the server answers payment requests itself from the agent card.
 */
export async function sendCheckoutMessage(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, checkoutMessageSchema);
  const parts: OutboundMessagePart[] = [];
  if (body.requestId) {
    const action = body.action ?? "submit";
    if (action === "submit") parts.push(submitResponse(body.requestId, body.values ?? {}));
    else if (action === "decline") parts.push(declineResponse(body.requestId));
    else parts.push(alternativeResponse(body.requestId, body.text!));
    if (body.text && action !== "alternative") parts.push({ type: "text", text: body.text });
  } else {
    parts.push({ type: "text", text: body.text! });
  }
  return json(await answer(ctx, user, params.id!, body.requestId, parts, body.messageId));
}

/** POST /v1/checkouts/:id/actions/:actionId. The older answer route; same as a `submit` message. */
export async function submitCheckoutAction(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, submitActionSchema);
  return json(await answer(ctx, user, params.id!, params.actionId!, [submitResponse(params.actionId!, body.values)]));
}

/** POST /v1/checkouts/:id/cancel */
export async function cancelCheckout(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const agentCardId = await ownedAgentCardId(ctx, user, params.id!);
  const cctx = checkoutContext(ctx, user);
  await ctx.crossmint.checkouts.cancel(cctx, params.id!);
  const checkout = await ctx.crossmint.checkouts.get(cctx, params.id!);
  return json(toView(checkout, agentCardId));
}

/** POST /v1/buyer-profiles */
export async function createBuyerProfile(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, buyerProfileSchema);
  const profile = await ctx.crossmint.checkouts.createBuyerProfile(checkoutContext(ctx, user), body);
  return json({ id: profile.id }, 201);
}

// ---------------------------------------------------------------------------

async function answer(
  ctx: Ctx,
  user: AuthenticatedUser,
  runId: string,
  requestId: string | undefined,
  parts: OutboundMessagePart[],
  messageId?: string,
): Promise<CheckoutView> {
  const agentCardId = await ownedAgentCardId(ctx, user, runId);
  const cctx = checkoutContext(ctx, user);
  let checkout = await ctx.crossmint.checkouts.get(cctx, runId);
  if (requestId) {
    const open = pendingActionOf(checkout);
    if (open && open.id === requestId && isPaymentAction(open)) {
      throw new HttpError(
        409,
        "payment_handled_by_server",
        "This request asks for card details. GOAT answers it from the agent card; do not send card fields.",
        { checkoutId: runId, requestId },
      );
    }
  }
  await ctx.crossmint.checkouts.sendMessage(cctx, runId, { id: messageId ?? newMessageId(), parts });
  checkout = await waitForConsumption(ctx, cctx, runId, requestId);
  return settlePayment(ctx, user, cctx, checkout, agentCardId);
}

/** Look up the agent card behind a checkout. 403 when another user owns it. */
async function ownedAgentCardId(ctx: Ctx, user: AuthenticatedUser, runId: string): Promise<string | undefined> {
  const link = await ctx.checkouts.getCheckout(runId);
  if (!link) return undefined;
  if (link.userId !== user.userId) throw forbidden();
  return link.agentCardId;
}

/**
 * Payment requests GOAT already answered, by run. A poll right after an
 * answer can still show the same request open; this stops a second card
 * from being minted for it. Per process; bounded.
 */
const answeredPayments = new Map<string, string>();
function rememberAnswered(runId: string, requestId: string): void {
  if (answeredPayments.size >= 500) {
    const oldest = answeredPayments.keys().next().value;
    if (oldest !== undefined) answeredPayments.delete(oldest);
  }
  answeredPayments.set(runId, requestId);
}

/**
 * If Crossmint asks for a card, mint one from the agent card and answer.
 * Callers never see the payment request.
 */
async function settlePayment(
  ctx: Ctx,
  user: AuthenticatedUser,
  cctx: CheckoutContext,
  checkout: Checkout,
  agentCardId: string | undefined,
): Promise<CheckoutView> {
  const action = pendingActionOf(checkout);
  if (!action || !isPaymentAction(action)) return toView(checkout, agentCardId);
  if (answeredPayments.get(checkout.runId) === action.id) return toView(checkout, agentCardId, { hidePayment: true });
  if (!agentCardId) {
    throw new HttpError(
      409,
      "no_usable_rail",
      "This checkout needs a payment but GOAT does not know its agent card",
      { checkoutId: checkout.runId },
    );
  }

  const maxCost = checkout.input?.constraints?.maxCost;
  const { card } = await mintFromAgentCard(ctx, user, agentCardId, {
    railPreference: ctx.railPreference,
    amount: (oi) => clampToAvailable(oi, maxCost),
    // Card networks issue a number per merchant. The checkout knows which store it is on.
    merchant: merchantFromCheckout(checkout),
  });
  if (!card) {
    throw new HttpError(409, "no_usable_rail", "The agent card did not return card details");
  }

  const values = fillPaymentAction(action, card);
  console.info("[goat] answering checkout payment request", {
    checkoutId: checkout.runId,
    requestId: action.id,
    agentCardId,
    fields: Object.keys(values),
  });
  await ctx.crossmint.checkouts.respond(cctx, checkout.runId, action.id, values);
  rememberAnswered(checkout.runId, action.id);
  const refreshed = await waitForConsumption(ctx, cctx, checkout.runId, action.id);
  return toView(refreshed, agentCardId, { hidePayment: true });
}

/** Refetch a few times until the answered request is gone or the run ends. */
async function waitForConsumption(ctx: Ctx, cctx: CheckoutContext, runId: string, requestId: string | undefined): Promise<Checkout> {
  let checkout = await ctx.crossmint.checkouts.get(cctx, runId);
  for (let i = 0; i < SETTLE_POLLS; i++) {
    const open = pendingActionOf(checkout);
    if (isTerminalCheckout(checkout) || !open || (requestId !== undefined && open.id !== requestId)) break;
    await new Promise((r) => setTimeout(r, SETTLE_WAIT_MS));
    checkout = await ctx.crossmint.checkouts.get(cctx, runId);
  }
  return checkout;
}

/** Mint for the checkout's max cost, but never more than the card has left. */
function clampToAvailable(oi: OrderIntent, maxCost?: { amount: string; currency: string }): Amount {
  const available: Amount = { value: oi.amount.available, currency: oi.amount.currency };
  if (!maxCost || maxCost.currency.toUpperCase() !== available.currency.toUpperCase()) {
    return available;
  }
  const want = Number.parseFloat(maxCost.amount);
  const have = Number.parseFloat(available.value);
  if (!Number.isFinite(want) || !Number.isFinite(have)) return available;
  return { value: Math.min(want, have).toFixed(2), currency: available.currency };
}

function toView(checkout: Checkout, agentCardId: string | undefined, opts: { hidePayment?: boolean } = {}): CheckoutView {
  const view: CheckoutView = { id: checkout.runId, status: checkout.status };
  if (agentCardId) view.agentCardId = agentCardId;
  const action = pendingActionOf(checkout);
  if (action) {
    if (isPaymentAction(action)) {
      // The server pays. To the caller the run is still working.
      if (opts.hidePayment) view.status = "running";
    } else {
      view.pendingUserAction = action;
      view.rendered = renderPendingAction(action);
    }
  }
  const embed = checkout.browser?.embedUrl;
  if (embed) {
    try {
      view.embedUrl = new URL(embed, CROSSMINT_WEB).toString();
    } catch {
      view.embedUrl = embed;
    }
  }
  if (checkout.result) view.result = checkout.result;
  const receipt = receiptOf(checkout);
  if (receipt) view.receipt = receipt;
  if (checkout.status === "failed") {
    view.failure = { reason: checkout.reason ?? "failed", ...(checkout.result?.summary ? { message: checkout.result.summary } : {}) };
  } else if (checkout.status === "blocked") {
    view.failure = { reason: checkout.result?.code ?? "blocked", ...(checkout.result?.summary ? { message: checkout.result.summary } : {}) };
  } else if (checkout.status === "cancelled") {
    view.failure = { reason: "cancelled", ...(checkout.result?.summary ? { message: checkout.result.summary } : {}) };
  }
  if (typeof checkout.knownSpentUsdMicros === "number" && checkout.knownSpentUsdMicros > 0) {
    view.spentUsd = (checkout.knownSpentUsdMicros / 1_000_000).toFixed(2);
  }
  if (checkout.createdAt) view.createdAt = checkout.createdAt;
  return view;
}

/** Merchant lock for a credential, derived from the checkout's start URL. */
export function merchantFromCheckout(checkout: Pick<Checkout, "input">): Merchant | undefined {
  const raw = checkout.input?.request?.startUrl;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    const tld = host.split(".").pop() ?? "";
    const countryCode = /^[a-z]{2}$/.test(tld) && tld !== "io" && tld !== "ai" && tld !== "co" ? tld.toUpperCase() : "US";
    return { name: host, url: url.origin, countryCode };
  } catch {
    return undefined;
  }
}
