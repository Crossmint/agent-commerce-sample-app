import type { AuthenticatedUser } from "@goat-wallet/auth";
import {
  fillPaymentAction,
  isPaymentAction,
  renderPendingAction,
  type Amount,
  type Checkout,
  type CheckoutContext,
  type Merchant,
  type OrderIntent,
  type PendingUserAction,
  type RenderedAction,
} from "@goat-wallet/core";
import { parseBody, requireUser, type Ctx } from "../context.js";
import { mintFromAgentCard } from "../credentials.js";
import { forbidden, HttpError, json } from "../errors.js";
import type { Params } from "../router.js";
import { buyerProfileSchema, createCheckoutSchema, submitActionSchema } from "../schemas.js";

const CROSSMINT_WEB = "https://www.crossmint.com";

export interface CheckoutView {
  id: string;
  status: string;
  agentCardId?: string;
  /** Only non-payment actions reach callers. */
  pendingUserAction?: PendingUserAction;
  rendered?: RenderedAction;
  /** Absolute URL for an iframe. */
  embedUrl?: string;
  receipt?: object;
  failure?: { reason: string; message?: string };
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
  const checkout = await ctx.crossmint.checkouts.create(cctx, {
    target: {
      kind: "direct_url",
      url: body.url,
      ...(body.request ? { request: body.request } : {}),
    },
    constraints: { maxCost: body.maxCost },
    ...(body.buyerProfileId ? { buyerProfileId: body.buyerProfileId } : {}),
  });
  await ctx.checkouts.linkCheckout(checkout.id, user.userId, body.agentCardId);
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

/** POST /v1/checkouts/:id/actions/:actionId */
export async function submitCheckoutAction(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, submitActionSchema);
  const agentCardId = await ownedAgentCardId(ctx, user, params.id!);
  const cctx = checkoutContext(ctx, user);
  const checkout = await ctx.crossmint.checkouts.submitAction(cctx, params.id!, params.actionId!, {
    action: "submit",
    values: body.values,
  });
  return json(await settlePayment(ctx, user, cctx, checkout, agentCardId));
}

/** POST /v1/buyer-profiles */
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

/** Look up the agent card behind a checkout. 403 when another user owns it. */
async function ownedAgentCardId(
  ctx: Ctx,
  user: AuthenticatedUser,
  checkoutId: string,
): Promise<string | undefined> {
  const link = await ctx.checkouts.getCheckout(checkoutId);
  if (!link) return undefined;
  if (link.userId !== user.userId) throw forbidden();
  return link.agentCardId;
}

/**
 * If Crossmint asks for a card, mint one from the agent card and answer.
 * Then refetch once. Callers never see the payment action.
 */
async function settlePayment(
  ctx: Ctx,
  user: AuthenticatedUser,
  cctx: CheckoutContext,
  checkout: Checkout,
  agentCardId: string | undefined,
): Promise<CheckoutView> {
  const action = checkout.pendingUserAction;
  if (checkout.status !== "awaiting_user_action" || !action || !isPaymentAction(action)) {
    return toView(checkout, agentCardId);
  }
  if (!agentCardId) {
    throw new HttpError(
      409,
      "no_usable_rail",
      "This checkout needs a payment but GOAT does not know its agent card",
      { checkoutId: checkout.id },
    );
  }

  const maxCost = checkout.constraints?.maxCost;
  const { card } = await mintFromAgentCard(ctx, user, agentCardId, {
    railPreference: ctx.railPreference,
    amount: (oi) => clampToAvailable(oi, maxCost),
    // Card networks issue a number per merchant. The checkout knows which store it is on.
    merchant: merchantFromTarget(checkout),
  });
  if (!card) {
    throw new HttpError(409, "no_usable_rail", "The agent card did not return card details");
  }

  const values = fillPaymentAction(action, card);
  console.info("[goat] answering checkout payment action", {
    checkoutId: checkout.id,
    actionId: action.id,
    agentCardId,
    fields: Object.keys(values),
  });
  await ctx.crossmint.checkouts.submitAction(cctx, checkout.id, action.id, {
    action: "submit",
    values,
  });
  const refreshed = await ctx.crossmint.checkouts.get(cctx, checkout.id);
  return toView(refreshed, agentCardId);
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

function toView(checkout: Checkout, agentCardId: string | undefined): CheckoutView {
  const view: CheckoutView = { id: checkout.id, status: checkout.status };
  if (agentCardId) view.agentCardId = agentCardId;
  const action = checkout.pendingUserAction;
  if (action && !isPaymentAction(action)) {
    view.pendingUserAction = action;
    view.rendered = renderPendingAction(action);
  }
  const embed = checkout.browser?.embedUrl;
  if (embed) {
    try {
      view.embedUrl = new URL(embed, CROSSMINT_WEB).toString();
    } catch {
      view.embedUrl = embed;
    }
  }
  if (checkout.receipt) view.receipt = checkout.receipt;
  if (checkout.failure) view.failure = checkout.failure;
  return view;
}

/** Merchant lock for a credential, derived from the checkout's target URL. */
export function merchantFromTarget(checkout: Checkout): Merchant | undefined {
  const raw = checkout.target?.url;
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
