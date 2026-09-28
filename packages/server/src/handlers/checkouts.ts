import type { AuthenticatedUser } from "@agent-commerce/auth";
import {
  alternativeResponse,
  asksPasswordInForm,
  declineResponse,
  expiresInHours,
  isPaymentAction,
  isProtectedAction,
  isTerminalCheckout,
  newMessageId,
  pendingActionOf,
  protectedResponse,
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
import { currentBuyerProfile, rememberBuyerProfile } from "../buyer-profile.js";
import { forbidden, HttpError, invalidRequest, json, noContent } from "../errors.js";
import { agentCardRequestId } from "../ids.js";
import type { Params } from "../router.js";
import {
  buyerProfileSchema,
  checkoutAgentCardSchema,
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
  /** The page the run started from, for the site it runs on. */
  startUrl?: string;
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
  /**
   * The store asks for the password of the user's account there. It is
   * never answered with values: show the user `url`, the checkout's page in
   * the app, where they type it into Crossmint's protected field and the app
   * answers the run.
   */
  passwordRequest?: CheckoutPasswordRequest;
  /** On `failed` (Crossmint's `reason`), `blocked` (the `code`) and `cancelled`. */
  failure?: { reason: string; message?: string };
  /** What the run has spent so far, in USD. */
  spentUsd?: string;
  createdAt?: string;
}

/** A password request, as a caller shows it: where the user types it, and for which store. */
export interface CheckoutPasswordRequest {
  requestId: string;
  question: string;
  /** The store the password is for: "shop.example.com". */
  merchantDomain?: string;
  expiresAt?: string;
  /** `${webBaseUrl}/checkouts/${id}`: the checkout's page, with the secure field. */
  url: string;
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
  if (!body.agentCardId && !body.merchant) {
    throw new HttpError(400, "merchant_required", "Provide the merchant name, URL and countryCode for card authorization");
  }
  if (body.merchant && hostOf(body.merchant.url) !== hostOf((body.startUrl ?? body.url)!)) {
    throw invalidRequest("The merchant must match the checkout start URL");
  }
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
  // The user's saved name, contact and address, so the store does not ask
  // for them again. A caller that names a profile keeps its own.
  const buyerProfileId =
    body.buyerProfileId ?? (await currentBuyerProfile(ctx, cctx, user.userId))?.id;
  const checkout = await ctx.crossmint.checkouts.create(cctx, {
    request: { startUrl: (body.startUrl ?? body.url)!, ...(task ? { task } : {}) },
    constraints: { maxCost: body.maxCost },
    ...(buyerProfileId ? { buyerProfileId } : {}),
    ...(browserProfileId ? { browserProfileId } : {}),
    ...(body.merchantGuidance ? { merchantGuidance: body.merchantGuidance } : {}),
  });
  await ctx.checkouts.linkCheckout(checkout.runId, user.userId, {
    ...(body.agentCardId ? { agentCardId: body.agentCardId } : {}),
    ...(body.purpose ? { purpose: body.purpose } : {}),
    ...(body.merchant ? { merchant: body.merchant } : {}),
  });
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
 * GET /v1/checkouts/:id/messages/stream?after=
 *
 * The run's transcript as server-sent events, passed through from Crossmint
 * as they come: `message.upsert` and `run.updated`, each with an `id` to
 * resume from (`after`, or the `Last-Event-ID` header). The browser cannot
 * call Crossmint itself, because the server key stays here. Closing the
 * request closes the upstream stream.
 *
 * A `run.updated` is the caller's cue to read the checkout again: that read
 * is where the payment step is raised and answered.
 */
export async function streamCheckoutMessages(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  await ownedLink(ctx, user, params.id!);
  const url = new URL(req.url);
  const upstream = await ctx.crossmint.checkouts.streamMessages(
    checkoutContext(ctx, user),
    params.id!,
    {
      after: url.searchParams.get("after") ?? undefined,
      lastEventId: req.headers.get("last-event-id") ?? undefined,
      signal: req.signal,
    },
  );
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Proxies that buffer would hold the events back.
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * POST /v1/checkouts/:id/messages
 * Answer the open input request, or send the agent a note. Card fields are
 * refused: the server answers payment requests itself from the agent card.
 * A password request is answered with the id from Crossmint's protected
 * field, which the app's own UI sends here; the secret never passes through.
 */
export async function sendCheckoutMessage(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, checkoutMessageSchema);
  // Crossmint takes one part per message, so an answer with a note is two messages.
  let part: OutboundMessagePart;
  let note: string | undefined;
  if (body.requestId) {
    const action = body.action ?? "submit";
    if (body.protectedInputId) part = protectedResponse(body.requestId, body.protectedInputId);
    else if (action === "submit") part = submitResponse(body.requestId, body.values ?? {});
    else if (action === "decline") part = declineResponse(body.requestId);
    else part = alternativeResponse(body.requestId, body.text!);
    if (body.text && action !== "alternative") note = body.text;
  } else {
    part = { type: "text", text: body.text! };
  }
  return json(await answer(ctx, user, params.id!, body.requestId, part, body.messageId, note));
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
    await answer(
      ctx,
      user,
      params.id!,
      params.actionId!,
      submitResponse(params.actionId!, body.values),
    ),
  );
}

/**
 * POST /v1/checkouts/:id/agent-card
 *
 * Pay the run from an agent card the user already has, instead of minting a
 * new one at the payment step. The user chose it; the card must be theirs,
 * active, with money left, and not locked to another store. Once linked, the
 * payment step is answered from it on this read, or on the first read after
 * the run gets there.
 */
export async function setCheckoutAgentCard(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, checkoutAgentCardSchema);
  const link = await ownedLink(ctx, user, params.id!);
  if (!link) throw new HttpError(404, "not_found", "No such checkout");
  const cctx = checkoutContext(ctx, user);
  const checkout = await ctx.crossmint.checkouts.get(cctx, params.id!);
  if (isTerminalCheckout(checkout)) {
    throw new HttpError(409, "checkout_finished", "This checkout has already ended");
  }

  // The user's JWT scopes the read: someone else's card is not found.
  const card = await ctx.crossmint.orderIntents.get({ jwt: user.jwt }, body.agentCardId);
  const available = Number.parseFloat(card.amount.available);
  if (card.status !== "active" || !(available > 0)) {
    throw new HttpError(
      409,
      "agent_card_unusable",
      "That agent card is not active or has nothing left to spend",
      {
        agentCardId: body.agentCardId,
        status: card.status,
        available: card.amount.available,
      },
    );
  }
  // At the payment step the run says what it needs; a card with less would
  // come back as insufficient_allowance.
  const action = pendingActionOf(checkout);
  const asked = action?.payment?.amount;
  if (
    asked &&
    card.amount.currency.toUpperCase() === asked.currency.toUpperCase() &&
    available < Number.parseFloat(asked.value)
  ) {
    throw new HttpError(
      409,
      "agent_card_unusable",
      `That agent card has ${card.amount.available} ${card.amount.currency} left; this checkout needs ${asked.value} ${asked.currency}`,
      { agentCardId: body.agentCardId, available: card.amount.available, needed: asked.value },
    );
  }
  const storeHost = action?.payment?.merchant?.domain ?? merchantFromCheckout(checkout)?.url;
  if (card.merchant && storeHost && hostOf(card.merchant.url) !== hostOf(storeHost)) {
    throw new HttpError(
      409,
      "agent_card_wrong_merchant",
      `That agent card only pays at ${card.merchant.name}`,
      {
        agentCardId: body.agentCardId,
      },
    );
  }

  await ctx.checkouts.linkCheckout(checkout.runId, user.userId, { agentCardId: body.agentCardId });
  const linked = (await ctx.checkouts.getCheckout(checkout.runId)) ?? undefined;
  return json(await settlePayment(ctx, user, cctx, checkout, linked));
}

/** "shop.example" from a URL or a bare domain. */
function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** POST /v1/checkouts/:id/cancel */
export async function cancelCheckout(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const link = await ownedLink(ctx, user, params.id!);
  const cctx = checkoutContext(ctx, user);
  await ctx.crossmint.checkouts.cancel(cctx, params.id!);
  const checkout = await ctx.crossmint.checkouts.get(cctx, params.id!);
  return json(toView(ctx.config.webBaseUrl, checkout, link?.agentCardId));
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

/**
 * POST /v1/buyer-profiles
 *
 * Save the user's name, contact and shipping address. The new profile is the
 * one every later checkout starts with.
 */
export async function createBuyerProfile(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, buyerProfileSchema);
  const profile = await ctx.crossmint.checkouts.createBuyerProfile(
    checkoutContext(ctx, user),
    body,
  );
  // Crossmint may answer with the id alone; what was saved is what was sent.
  rememberBuyerProfile(ctx, user.userId, { ...body, ...profile });
  return json({ id: profile.id }, 201);
}

/**
 * GET /v1/buyer-profile
 *
 * The saved details later checkouts start with, or null when there are none.
 */
export async function getBuyerProfile(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const profile = await currentBuyerProfile(ctx, checkoutContext(ctx, user), user.userId);
  return json({ buyerProfile: profile ?? null });
}

// ---------------------------------------------------------------------------

async function answer(
  ctx: Ctx,
  user: AuthenticatedUser,
  runId: string,
  requestId: string | undefined,
  part: OutboundMessagePart,
  messageId?: string,
  /** Free text sent after the answer, as a message of its own. */
  note?: string,
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
        "This is the checkout's payment step. It is not answered here: the user picks a payment method, and Agent Commerce answers the run with the agent card that makes. Do not send card fields.",
        { checkoutId: runId, requestId },
      );
    }
    const submit =
      part.type === "input_response" && part.action === "submit" ? part.response.kind : undefined;
    if (open && open.id === requestId && isProtectedAction(open) && submit === "form") {
      throw new HttpError(
        409,
        "protected_input_required",
        "The store asks for a secret, such as the password of the user's account there. It is never answered with values: the user types it into Crossmint's protected field in the app, which answers the run. Decline it, or send an alternative such as checking out as a guest.",
        { checkoutId: runId, requestId },
      );
    }
    if (open && open.id === requestId && asksPasswordInForm(open) && submit === "form") {
      throw new HttpError(
        409,
        "password_in_form",
        "The store asks for a password in a plain form. It is never answered with values: Agent Checkouts does not fill a password from them, and it would pass through the app and the agent. Decline it, or send an alternative such as checking out as a guest. Asking for a password with a secure field needs protected inputs enabled on the Crossmint project.",
        { checkoutId: runId, requestId },
      );
    }
    if (submit === "protected" && !(open && open.id === requestId && isProtectedAction(open))) {
      throw new HttpError(
        409,
        "not_a_protected_request",
        "The open request does not ask for a protected input, or it is no longer open.",
        { checkoutId: runId, requestId },
      );
    }
  }
  await ctx.crossmint.checkouts.sendMessage(cctx, runId, {
    id: messageId ?? newMessageId(),
    parts: [part],
  });
  if (note) {
    await ctx.crossmint.checkouts.sendMessage(cctx, runId, {
      id: newMessageId(),
      parts: [{ type: "text", text: note }],
    });
  }
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
 * The payment request Agent Commerce last answered, by run, and the order
 * intent it answered with. A poll right after an answer can still show the
 * same request open; this stops a second answer. And when the run asks
 * again, with a new request, the order intent that went before did not work
 * (expired, too small, cancelled), so that one is not offered again. Per
 * process; bounded.
 */
const answeredPayments = new Map<string, { requestId: string; orderIntentId: string }>();
function rememberAnswered(runId: string, requestId: string, orderIntentId: string): void {
  if (answeredPayments.size >= 500) {
    const oldest = answeredPayments.keys().next().value;
    if (oldest !== undefined) answeredPayments.delete(oldest);
  }
  answeredPayments.set(runId, { requestId, orderIntentId });
}

/** How long an order intent made at the payment step lasts: the rest of the checkout, not an allowance. */
const PAYMENT_ORDER_INTENT_HOURS = 2;

/**
 * What the payment step wants authorized: the amount its request states
 * (Crossmint's verified payable total, or the run's ceiling), else the
 * checkout's max cost for an older request that states none.
 */
function paymentAmount(action: PendingUserAction, checkout: Checkout): Amount {
  const asked = action.payment?.amount;
  if (asked) return { value: asked.value, currency: asked.currency.toUpperCase() };
  const maxCost = checkout.input?.constraints?.maxCost;
  return { value: maxCost?.amount ?? "0", currency: maxCost?.currency ?? "USD" };
}

/**
 * The payment step.
 *
 * Partway through, the run asks to be paid: a payment input request
 * (`interaction.kind: "payment"`) stating the amount and the merchant. Agent
 * Commerce never passes it on. It answers with the id of an order intent (an
 * agent card) the user authorized for that amount, and Agent Checkouts mints
 * the card credential from it itself; no card number is ever sent.
 *
 * Which order intent depends on how the checkout started. One created with an
 * `agentCardId`, or given one later, pays from it straight away. One without
 * (the ordinary case) has none yet, so this raises an agent card request for
 * the exact amount the run asks for, and hands it back on the view. The user
 * picks a payment method there, that creates the order intent, and the next
 * read answers the run with it.
 */
const paymentSettlements = new WeakMap<Ctx, Map<string, Promise<CheckoutView>>>();
function settlePayment(
  ctx: Ctx,
  user: AuthenticatedUser,
  cctx: CheckoutContext,
  checkout: Checkout,
  link: CheckoutLink | undefined,
): Promise<CheckoutView> {
  let pending = paymentSettlements.get(ctx);
  if (!pending) {
    pending = new Map();
    paymentSettlements.set(ctx, pending);
  }
  const key = `${user.userId}:${checkout.runId}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const work = settlePaymentOnce(ctx, user, cctx, checkout, link).finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}

async function settlePaymentOnce(
  ctx: Ctx,
  user: AuthenticatedUser,
  cctx: CheckoutContext,
  checkout: Checkout,
  link: CheckoutLink | undefined,
): Promise<CheckoutView> {
  const action = pendingActionOf(checkout);
  if (!action || !isPaymentAction(action))
    return toView(ctx.config.webBaseUrl, checkout, link?.agentCardId);
  const answered = answeredPayments.get(checkout.runId);
  if (answered?.requestId === action.id)
    return toView(ctx.config.webBaseUrl, checkout, link?.agentCardId, { hidePayment: true });
  // Asked again after an answer: that order intent did not work. Not again.
  const spent = answered?.orderIntentId;

  let orderIntentId = link?.agentCardId !== spent ? link?.agentCardId : undefined;
  if (!orderIntentId) {
    const request = await paymentStepRequest(ctx, user, checkout, link, action, spent);
    // Until the user has chosen and the card can pay, the payment step is
    // the view: the run stays `awaiting_input` and the UI shows the picker.
    if (request.status !== "active" || !request.agentCardId) {
      return toView(ctx.config.webBaseUrl, checkout, undefined, {
        paymentRequest: toPaymentRequest(request),
      });
    }
    orderIntentId = request.agentCardId;
    await ctx.checkouts.linkCheckout(checkout.runId, user.userId, { agentCardId: orderIntentId });
  }

  console.info("[agent-commerce] answering checkout payment request", {
    checkoutId: checkout.runId,
    requestId: action.id,
    agentCardId: orderIntentId,
  });
  await ctx.crossmint.checkouts.payWithOrderIntent(cctx, checkout.runId, action.id, orderIntentId);
  rememberAnswered(checkout.runId, action.id, orderIntentId);
  const refreshed = await waitForConsumption(ctx, cctx, checkout.runId, action.id);
  return toView(ctx.config.webBaseUrl, refreshed, orderIntentId, { hidePayment: true });
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
  action: PendingUserAction,
  /** An order intent the run already turned down: a request that made it is spent. */
  spent: string | undefined,
): Promise<AgentCardRequest> {
  const amount = paymentAmount(action, checkout);
  const merchant = link?.merchant;
  if (!merchant) {
    throw new HttpError(409, "merchant_required", "Start a new checkout with explicit merchant details");
  }
  const paymentHost = action.payment?.merchant?.domain ?? merchantFromCheckout(checkout)?.url;
  if (paymentHost && hostOf(merchant.url) !== hostOf(paymentHost)) {
    throw new HttpError(409, "agent_card_wrong_merchant", "The payment merchant changed; start a new checkout for that merchant");
  }
  if (link?.agentCardRequestId) {
    const existing = await ctx.store.get(link.agentCardRequestId);
    // Approved but not yet active: the card exists and verification may have
    // landed elsewhere, so settle it before deciding the step is unfinished.
    // A request for another amount, or one whose card the run turned down,
    // does not answer this one: the run wants a new authorization.
    const fits =
      existing &&
      existing.amount.value === amount.value &&
      existing.amount.currency.toUpperCase() === amount.currency &&
      existing.merchant?.url === merchant.url &&
      existing.merchant?.countryCode === merchant.countryCode &&
      (!spent || existing.agentCardId !== spent);
    if (existing && fits) return reconcileRequest(ctx, user, existing);
  }

  const now = ctx.now();
  const id = agentCardRequestId();
  const domain = action.payment?.merchant?.domain ?? merchantFromCheckout(checkout)?.name;
  // The SDK authorizes the requested amount for this merchant and checkout window.
  const row: NewAgentCardRequest = {
    id,
    userId: user.userId,
    requester: ctx.defaultRequester,
    amount,
    merchant,
    // Short, for the approval screen and the card list: the purpose the
    // caller gave the checkout, else the store. Never the run's task, which
    // is written for the store's agent and runs to paragraphs.
    description:
      link?.purpose ?? (domain ? `Purchase at ${domain.replace(/^www\./, "")}` : "Purchase"),
    expiresAt: expiresInHours(PAYMENT_ORDER_INTENT_HOURS, now),
    requestExpiresAt: new Date(now.getTime() + ctx.requestTtlMinutes * 60_000).toISOString(),
    status: "pending",
    approvalUrl: `${ctx.config.webBaseUrl.replace(/\/$/, "")}/approve/${id}`,
  };
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

function toView(
  /** The app's origin, for the links a caller shows the user. */
  webBaseUrl: string,
  checkout: Checkout,
  agentCardId: string | undefined,
  opts: { hidePayment?: boolean; paymentRequest?: CheckoutPaymentRequest } = {},
): CheckoutView {
  const view: CheckoutView = { id: checkout.runId, status: checkout.status };
  const startUrl = checkout.input?.request?.startUrl;
  if (startUrl) view.startUrl = startUrl;
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
      // A secret has no form: the app shows Crossmint's protected field instead.
      if (isProtectedAction(action)) {
        view.passwordRequest = {
          requestId: action.id,
          question: action.question,
          ...(action.protected?.merchant
            ? { merchantDomain: action.protected.merchant.domain }
            : {}),
          ...(action.expiresAt ? { expiresAt: action.expiresAt } : {}),
          url: `${webBaseUrl.replace(/\/$/, "")}/checkouts/${encodeURIComponent(checkout.runId)}`,
        };
      } else if (!asksPasswordInForm(action)) {
        // A password in a plain form gets no form either: it is declined, never filled in.
        view.rendered = renderPendingAction(action);
      }
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
