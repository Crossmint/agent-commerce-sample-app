import type { AuthenticatedUser } from "@agent-commerce/auth";
import {
  alternativeResponse,
  declineResponse,
  expiresInHours,
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
} from "@agent-commerce/core";
import { parseBody, requireUser, type Ctx } from "../context.js";
import {
  findBrowserProfileId,
  forgetBrowserProfile,
  stickyBrowserProfileId,
} from "../browser-profile.js";
import { mintFromAgentCard } from "../credentials.js";
import { forbidden, HttpError, json, noContent } from "../errors.js";
import { agentCardRequestId } from "../ids.js";
import type { Params } from "../router.js";
import {
  buyerProfileSchema,
  checkoutMessageSchema,
  createCheckoutSchema,
  submitActionSchema,
} from "../schemas.js";
import type { AgentCardRequest, CheckoutLink, NewAgentCardRequest } from "../types.js";
import { reconcileRequest } from "./agent-card-requests.js";

const CROSSMINT_WEB = "https://www.crossmint.com";

/** After answering payment, refetch this many times, this far apart, for the run to consume the answer. */
const SETTLE_POLLS = 2;
const SETTLE_WAIT_MS = 1200;

/**
 * The run has reached its payment step and nothing pays for it yet.
 *
 * Crossmint asks for card details; Agent Commerce never hands those to the
 * caller. Instead the user picks one of their saved payment methods on this
 * request, which mints an agent card scoped to the purchase, and the server
 * answers the store from it.
 */
export interface CheckoutPaymentRequest {
  /** Answer it with the agent card request endpoints, or at `approvalUrl`. */
  requestId: string;
  status: AgentCardRequest["status"];
  approvalUrl: string;
  /** The checkout's max cost: what the agent card is scoped to. */
  amount: Amount;
  description: string;
  merchant?: Merchant;
  /** Set once a card exists but cannot pay yet, while verification lands. */
  agentCardId?: string;
  failureReason?: string;
}

/**
 * What Agent Commerce returns for a checkout. A flat view of Crossmint's run: the open
 * question (never a raw payment form), the live browser, and the outcome.
 */
export interface CheckoutView {
  /** Crossmint's `runId`. */
  id: string;
  status: CheckoutStatus;
  agentCardId?: string;
  /**
   * The run is waiting on a payment method. Show the user their saved cards
   * here: choosing one mints the agent card that pays.
   */
  paymentRequest?: CheckoutPaymentRequest;
  /** The open input request. `id` is the requestId to answer. Raw payment forms never appear: the server answers them. */
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
  /*
   * Sessions are sticky by default: without a profile every run starts in a
   * fresh browser and the store asks the user to log in again. A caller that
   * names its own profile keeps it; one that asks for `freshBrowser` gets the
   * signed-out browser, which is the way out of a login that has gone stale.
   */
  const browserProfileId = body.browserProfileId
    ? body.browserProfileId
    : body.freshBrowser
      ? undefined
      : await stickyBrowserProfileId(ctx, cctx, user.userId);
  const checkout = await ctx.crossmint.checkouts.create(cctx, {
    request: { startUrl: (body.startUrl ?? body.url)!, ...(task ? { task } : {}) },
    constraints: { maxCost: body.maxCost },
    ...(body.buyerProfileId ? { buyerProfileId: body.buyerProfileId } : {}),
    ...(browserProfileId ? { browserProfileId } : {}),
    ...(body.merchantGuidance ? { merchantGuidance: body.merchantGuidance } : {}),
  });
  await ctx.checkouts.linkCheckout(
    checkout.runId,
    user.userId,
    body.agentCardId ? { agentCardId: body.agentCardId } : undefined,
  );
  const link = (await ctx.checkouts.getCheckout(checkout.runId)) ?? undefined;
  const view = await settlePayment(ctx, user, cctx, checkout, link);
  return json(view, 201);
}

/** GET /v1/checkouts/:id */
export async function getCheckout(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const link = await ownedLink(ctx, user, params.id!);
  const cctx = checkoutContext(ctx, user);
  const checkout = await ctx.crossmint.checkouts.get(cctx, params.id!);
  return json(await settlePayment(ctx, user, cctx, checkout, link));
}

/** GET /v1/checkouts/:id/messages?cursor&limit */
export async function listCheckoutMessages(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  await ownedLink(ctx, user, params.id!);
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit");
  const list: CheckoutMessageList = await ctx.crossmint.checkouts.listMessages(
    checkoutContext(ctx, user),
    params.id!,
    {
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: limit ? Number(limit) : undefined,
    },
  );
  return json(list);
}

/**
 * POST /v1/checkouts/:id/messages
 * Answer the open input request, or send the agent a note. Card fields are
 * refused: the server answers payment requests itself from the agent card.
 */
export async function sendCheckoutMessage(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
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
export async function submitCheckoutAction(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, submitActionSchema);
  return json(
    await answer(ctx, user, params.id!, params.actionId!, [
      submitResponse(params.actionId!, body.values),
    ]),
  );
}

/** POST /v1/checkouts/:id/cancel */
export async function cancelCheckout(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const link = await ownedLink(ctx, user, params.id!);
  const cctx = checkoutContext(ctx, user);
  await ctx.crossmint.checkouts.cancel(cctx, params.id!);
  const checkout = await ctx.crossmint.checkouts.get(cctx, params.id!);
  return json(toView(checkout, link?.agentCardId));
}

/** POST /v1/buyer-profiles */
/**
 * GET /v1/browser-profile
 *
 * What the user's saved merchant logins amount to: metadata, because that is
 * all Crossmint hands back. Null until a checkout has made the profile —
 * reading is no reason to start saving.
 */
export async function getBrowserProfile(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const cctx = checkoutContext(ctx, user);
  const id = await findBrowserProfileId(ctx, cctx, user.userId);
  return json({ browserProfile: id ? { id } : null });
}

/**
 * DELETE /v1/browser-profile
 *
 * Sign out everywhere. Irreversible: it erases the stored browser state, not
 * just the record. The next checkout starts signed out and makes a new profile
 * from whatever the user logs into then.
 */
export async function deleteBrowserProfile(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const cctx = checkoutContext(ctx, user);
  const id = await findBrowserProfileId(ctx, cctx, user.userId);
  if (id) await ctx.crossmint.checkouts.deleteBrowserProfile(cctx, id);
  forgetBrowserProfile(ctx, user.userId);
  return noContent();
}

export async function createBuyerProfile(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, buyerProfileSchema);
  const profile = await ctx.crossmint.checkouts.createBuyerProfile(
    checkoutContext(ctx, user),
    body,
  );
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
  const link = await ownedLink(ctx, user, runId);
  const cctx = checkoutContext(ctx, user);
  let checkout = await ctx.crossmint.checkouts.get(cctx, runId);
  if (requestId) {
    const open = pendingActionOf(checkout);
    if (open && open.id === requestId && isPaymentAction(open)) {
      throw new HttpError(
        409,
        "payment_handled_by_server",
        "This request asks for card details. Answer the checkout's payment step instead: the user picks a payment method and Agent Commerce answers from the agent card it mints. Do not send card fields.",
        { checkoutId: runId, requestId },
      );
    }
  }
  await ctx.crossmint.checkouts.sendMessage(cctx, runId, {
    id: messageId ?? newMessageId(),
    parts,
  });
  checkout = await waitForConsumption(ctx, cctx, runId, requestId);
  return settlePayment(ctx, user, cctx, checkout, link);
}

/** Look up what Agent Commerce knows about a checkout. 403 when another user owns it. */
async function ownedLink(
  ctx: Ctx,
  user: AuthenticatedUser,
  runId: string,
): Promise<CheckoutLink | undefined> {
  const link = await ctx.checkouts.getCheckout(runId);
  if (!link) return undefined;
  if (link.userId !== user.userId) throw forbidden();
  return link;
}

/**
 * Payment requests Agent Commerce already answered, by run. A poll right after an
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
 * The payment step.
 *
 * Crossmint asks for card details partway through a run. Agent Commerce never
 * passes that question on: it answers with a credential minted from an agent
 * card, so no card number reaches the caller.
 *
 * Which agent card depends on how the checkout started. One created with an
 * `agentCardId` pays from it straight away, and the caller sees nothing. One
 * created without — the ordinary case, where the user just asked to buy
 * something — has no card yet, so this raises an agent card request scoped to
 * the purchase and hands it back on the view. The user picks a payment method
 * there, that mints the card, and the next poll pays with it.
 */
async function settlePayment(
  ctx: Ctx,
  user: AuthenticatedUser,
  cctx: CheckoutContext,
  checkout: Checkout,
  link: CheckoutLink | undefined,
): Promise<CheckoutView> {
  const action = pendingActionOf(checkout);
  if (!action || !isPaymentAction(action)) return toView(checkout, link?.agentCardId);
  if (answeredPayments.get(checkout.runId) === action.id)
    return toView(checkout, link?.agentCardId, { hidePayment: true });

  let agentCardId = link?.agentCardId;
  if (!agentCardId) {
    const request = await paymentStepRequest(ctx, user, checkout, link);
    // Until the user has chosen and the card can pay, the payment step is
    // the view: the run stays `awaiting_input` and the UI shows the picker.
    if (request.status !== "active" || !request.agentCardId) {
      return toView(checkout, undefined, { paymentRequest: toPaymentRequest(request) });
    }
    agentCardId = request.agentCardId;
    await ctx.checkouts.linkCheckout(checkout.runId, user.userId, { agentCardId });
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
  console.info("[agent-commerce] answering checkout payment request", {
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

/**
 * The agent card request that stands for a checkout's payment step.
 *
 * One per run: the same request is reused on every poll, so a user staring at
 * the picker is not handed a fresh one each second. A request the user denied
 * is returned as it is, because a refusal should stick — to try another card,
 * cancel the checkout and start again.
 */
async function paymentStepRequest(
  ctx: Ctx,
  user: AuthenticatedUser,
  checkout: Checkout,
  link: CheckoutLink | undefined,
): Promise<AgentCardRequest> {
  if (link?.agentCardRequestId) {
    const existing = await ctx.store.get(link.agentCardRequestId);
    // Approved but not yet active: the card exists and verification may have
    // landed elsewhere, so settle it before deciding the step is unfinished.
    if (existing) return reconcileRequest(ctx, user, existing);
  }

  const now = ctx.now();
  const id = agentCardRequestId();
  const maxCost = checkout.input?.constraints?.maxCost;
  const merchant = merchantFromCheckout(checkout);
  const task = checkout.input?.request?.task?.trim();
  const row: NewAgentCardRequest = {
    id,
    userId: user.userId,
    requester: ctx.defaultRequester,
    amount: { value: maxCost?.amount ?? "0", currency: maxCost?.currency ?? "USD" },
    // What the user is about to pay for, in their own terms where we have them.
    description: task || (merchant ? `Checkout at ${merchant.name}` : "Checkout"),
    expiresAt: expiresInHours(24, now),
    requestExpiresAt: new Date(now.getTime() + ctx.requestTtlMinutes * 60_000).toISOString(),
    status: "pending",
    approvalUrl: `${ctx.config.webBaseUrl.replace(/\/$/, "")}/approve/${id}`,
  };
  // The run is already at this store, so the card is locked to it.
  if (merchant) row.merchant = merchant;
  const created = await ctx.store.create(row);
  await ctx.checkouts.linkCheckout(checkout.runId, user.userId, { agentCardRequestId: id });
  return created;
}

/** The request, trimmed to what a caller needs to answer it. */
function toPaymentRequest(request: AgentCardRequest): CheckoutPaymentRequest {
  return {
    requestId: request.id,
    status: request.status,
    approvalUrl: request.approvalUrl,
    amount: request.amount,
    description: request.description,
    ...(request.merchant ? { merchant: request.merchant } : {}),
    ...(request.agentCardId ? { agentCardId: request.agentCardId } : {}),
    ...(request.failureReason ? { failureReason: request.failureReason } : {}),
  };
}

/** Refetch a few times until the answered request is gone or the run ends. */
async function waitForConsumption(
  ctx: Ctx,
  cctx: CheckoutContext,
  runId: string,
  requestId: string | undefined,
): Promise<Checkout> {
  let checkout = await ctx.crossmint.checkouts.get(cctx, runId);
  for (let i = 0; i < SETTLE_POLLS; i++) {
    const open = pendingActionOf(checkout);
    if (isTerminalCheckout(checkout) || !open || (requestId !== undefined && open.id !== requestId))
      break;
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

function toView(
  checkout: Checkout,
  agentCardId: string | undefined,
  opts: { hidePayment?: boolean; paymentRequest?: CheckoutPaymentRequest } = {},
): CheckoutView {
  const view: CheckoutView = { id: checkout.runId, status: checkout.status };
  if (agentCardId) view.agentCardId = agentCardId;
  if (opts.paymentRequest) view.paymentRequest = opts.paymentRequest;
  const action = pendingActionOf(checkout);
  if (action) {
    if (isPaymentAction(action)) {
      // Never the raw card form. Either the server is about to answer it, and
      // to the caller the run is still working, or `paymentRequest` carries
      // the step and the run stays `awaiting_input`.
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
    view.failure = {
      reason: checkout.reason ?? "failed",
      ...(checkout.result?.summary ? { message: checkout.result.summary } : {}),
    };
  } else if (checkout.status === "blocked") {
    view.failure = {
      reason: checkout.result?.code ?? "blocked",
      ...(checkout.result?.summary ? { message: checkout.result.summary } : {}),
    };
  } else if (checkout.status === "cancelled") {
    view.failure = {
      reason: "cancelled",
      ...(checkout.result?.summary ? { message: checkout.result.summary } : {}),
    };
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
    const countryCode =
      /^[a-z]{2}$/.test(tld) && tld !== "io" && tld !== "ai" && tld !== "co"
        ? tld.toUpperCase()
        : "US";
    return { name: host, url: url.origin, countryCode };
  } catch {
    return undefined;
  }
}
