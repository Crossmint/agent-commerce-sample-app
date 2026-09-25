import { asksPasswordInForm } from "@agent-commerce/core";
import type { CheckoutView } from "@agent-commerce/server";
import type { ApproveOutcome } from "@agent-commerce/ui";
import type { CheckoutMessage } from "@agent-commerce/core";
import type { CheckoutStep } from "@agent-commerce/ui";
import type { FoundProduct } from "@/lib/chat/shopify-catalog";
import { formatAmount, paymentMethodLabel } from "@agent-commerce/ui";
import type { ReceiptData } from "@/components/receipt";
import type {
  ApprovalOutcome,
  CheckoutOutcome,
  CheckoutUpdate,
  ShownReceipt,
} from "@/lib/chat/tools";
import type { ChatMessage, ChatMessagePart } from "@/lib/chat/types";

/*
 * What the three chat renderers share about a message's parts: how to name a
 * tool call, how to read the request behind an approval, and how to turn the
 * approval screen's outcome into the tool output the model reads. Pure
 * functions, so every frame draws the same facts its own way.
 */

/** The `request_agent_card` result, as the tool returns it. */
export interface RequestSummary {
  requestId: string;
  approvalUrl: string;
  status: string;
  amount: { value: string; currency: string };
  description: string;
  merchant?: { name: string; url: string };
  expiresAt: string;
}

export type ToolError = { error: string; code: string };

/** Where a tool call stands, as the AI SDK names it. */
export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

/** "list_agent_cards" → "List agent cards". */
function humanizeToolName(name: string): string {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isToolError(value: unknown): value is ToolError {
  return Boolean(value) && typeof value === "object" && typeof (value as ToolError).error === "string";
}

/** The request the approval part refers to, found in the same message. */
export function findRequest(message: ChatMessage, requestId: string): RequestSummary | undefined {
  for (const part of message.parts) {
    if (part.type !== "tool-request_agent_card" || part.state !== "output-available") continue;
    const output = part.output as RequestSummary | ToolError;
    if (!isToolError(output) && output.requestId === requestId) return output;
  }
  return undefined;
}

/** The approval screen's outcome, cut down to what the tool promised the model. */
export function toApprovalOutcome(o: ApproveOutcome): ApprovalOutcome {
  return { status: o.status, agentCardId: o.agentCard?.orderIntentId ?? o.request.agentCardId };
}

const ENDINGS = ["succeeded", "blocked", "failed", "cancelled"] as const;

/**
 * What the store's agent has written so far, one update per progress or text
 * part of its messages, oldest first. Questions are left out: the model asks
 * those itself. The id is stable across polls, so a later watch can tell what
 * the chat already showed.
 */
export function feedUpdates(messages: CheckoutMessage[]): CheckoutUpdate[] {
  const out: CheckoutUpdate[] = [];
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    m.parts.forEach((part, i) => {
      if (part.type !== "progress" && part.type !== "text") return;
      const text = typeof part.text === "string" ? part.text.trim() : "";
      if (text && out.at(-1)?.text !== text) out.push({ id: `${m.id}:${i}`, text });
    });
  }
  return out;
}

/**
 * Why a watch should hand back now, or undefined to keep polling: the run
 * ended, the store asks a question not handed back before, or the payment
 * step waits on the user. The caller adds the updates.
 */
export function stopReason(
  view: CheckoutView,
  asked: ReadonlySet<string>,
): Omit<CheckoutOutcome, "updates"> | undefined {
  const ending = ENDINGS.find((s) => s === view.status);
  if (ending) {
    return {
      checkoutId: view.id,
      status: ending,
      ...(view.receipt ? { total: view.receipt.total } : {}),
      ...(view.receipt?.merchantOrderId ? { merchantOrderId: view.receipt.merchantOrderId } : {}),
      ...(view.result?.summary ? { summary: view.result.summary } : {}),
      ...(view.failure ? { failure: view.failure } : {}),
    };
  }
  const pay = view.paymentRequest;
  // Approved and about to pay: the next read answers the store, so keep going.
  if (pay && pay.status !== "active") {
    return {
      checkoutId: view.id,
      status: "awaiting_payment",
      payment: {
        requestId: pay.requestId,
        status: pay.status,
        amount: pay.amount,
        description: pay.description,
        ...(pay.merchant ? { merchant: { name: pay.merchant.name, url: pay.merchant.url } } : {}),
      },
    };
  }
  const action = view.pendingUserAction;
  // A password: the chat shows Crossmint's protected field, never a question in words.
  if (view.status === "awaiting_input" && action?.protected && !asked.has(action.id)) {
    return {
      checkoutId: view.id,
      status: "awaiting_password",
      password: {
        requestId: action.id,
        question: action.question || "The store asks for your password.",
        ...(action.protected.merchant ? { domain: action.protected.merchant.domain } : {}),
      },
    };
  }
  // Watching again right after an answer can still see that question for a
  // moment, until the store takes it. It was asked; wait for what comes next.
  if (view.status === "awaiting_input" && action && !pay && !asked.has(action.id)) {
    return {
      checkoutId: view.id,
      status: "awaiting_input",
      question: {
        requestId: action.id,
        question: action.question || view.rendered?.title || "The store needs an answer.",
        ...(action.expiresAt ? { expiresAt: action.expiresAt } : {}),
        responseSchema: action.responseSchema as Record<string, unknown>,
        ...(asksPasswordInForm(action) ? { note: PASSWORD_IN_FORM_NOTE } : {}),
      },
    };
  }
  return undefined;
}

/**
 * True when a `watch_checkout` in the same message covers this checkout
 * part's run. The watch says all the part would, so the part draws nothing.
 */
export function watchedHere(message: ChatMessage, part: ChatMessagePart): boolean {
  const id = checkoutIdOf(part);
  if (!id) return false;
  return message.parts.some((p) => p.type === "tool-watch_checkout" && p.input?.checkoutId === id);
}

/** What the agent is told when a store asks for a password in a plain form. */
const PASSWORD_IN_FORM_NOTE =
  "This asks for the user's password in a plain form. Never ask the user for it and never send it: it would pass through the chat, and the store's agent does not use a password sent that way. Tell the user in one line that this store wants them to sign in, which cannot be done safely here, and ask whether to check out as a guest instead (answer_checkout with action alternative) or stop (action decline).";

/** What the thread's finished watches already did, so the next one does not do it twice. */
export interface WatchIndex {
  /** Updates already posted, by checkout. A new watch posts only what came after. */
  shown: Map<string, Set<string>>;
  /** Questions already handed to the model. */
  asked: Set<string>;
  /** Agent card requests raised by a checkout's payment step: approving one is choosing how to pay. */
  paymentRequests: Set<string>;
  /** Where each checkout runs and what the agent does there, from its `create_checkout`. */
  sites: Map<string, CheckoutSite>;
  /** Each checkout's first `watch_checkout`, by tool call id. */
  firstWatch: Map<string, string>;
  /** Password requests a watch handed back, by requestId: the store the password is for, from the checkout itself. */
  passwords: Map<string, { checkoutId: string; domain?: string }>;
  /**
   * Watches whose card the next watch takes over: the stretch stopped on a
   * question the agent answered itself, with nothing shown in between, so the
   * two read as one card.
   */
  absorbed: Set<string>;
  /** What such a watch takes over, by its tool call id: the earlier steps, when the card began, and the watch that began it. */
  carried: Map<string, { updates: CheckoutUpdate[]; startedAt?: string; chainStart: string }>;
}

/** Parts that show the user nothing between two stretches of a checkout. */
const UNSEEN_BETWEEN_WATCHES = new Set([
  "step-start",
  "reasoning",
  "tool-answer_checkout",
  "tool-get_checkout",
]);

export function watchIndex(messages: ChatMessage[]): WatchIndex {
  const index: WatchIndex = {
    shown: new Map(),
    asked: new Set(),
    paymentRequests: new Set(),
    sites: new Map(),
    firstWatch: new Map(),
    passwords: new Map(),
    absorbed: new Set(),
    carried: new Map(),
  };
  for (const m of messages) {
    // The last watch of each checkout in this message, while nothing visible has come after it.
    const lastWatch = new Map<string, Extract<ChatMessagePart, { type: "tool-watch_checkout" }>>();
    for (const part of m.parts) {
      if (part.type === "tool-watch_checkout" && part.input?.checkoutId) {
        const prev = lastWatch.get(part.input.checkoutId);
        if (prev?.state === "output-available" && prev.output.status === "awaiting_input") {
          const before = index.carried.get(prev.toolCallId);
          index.absorbed.add(prev.toolCallId);
          index.carried.set(part.toolCallId, {
            updates: [...(before?.updates ?? []), ...(prev.output.updates ?? [])],
            ...((before?.startedAt ?? prev.output.startedAt)
              ? { startedAt: before?.startedAt ?? prev.output.startedAt }
              : {}),
            chainStart: before?.chainStart ?? prev.toolCallId,
          });
        }
        lastWatch.set(part.input.checkoutId, part);
      } else if (
        !UNSEEN_BETWEEN_WATCHES.has(part.type) &&
        !(part.type === "text" && !part.text.trim())
      ) {
        lastWatch.clear();
      }
    }
    for (const part of m.parts) {
      const site = checkoutSiteOf(part);
      if (site?.checkoutId) index.sites.set(site.checkoutId, site);
      if (part.type !== "tool-watch_checkout") continue;
      const id = part.input?.checkoutId;
      if (id) {
        if (!index.firstWatch.has(id)) index.firstWatch.set(id, part.toolCallId);
      }
      if (part.state !== "output-available") continue;
      const out = part.output;
      let shown = index.shown.get(out.checkoutId);
      if (!shown) index.shown.set(out.checkoutId, (shown = new Set()));
      for (const u of out.updates ?? []) shown.add(u.id);
      if (out.question) index.asked.add(out.question.requestId);
      if (out.password) {
        index.asked.add(out.password.requestId);
        index.passwords.set(out.password.requestId, {
          checkoutId: out.checkoutId,
          ...(out.password.domain ? { domain: out.password.domain } : {}),
        });
      }
      if (out.payment) index.paymentRequests.add(out.payment.requestId);
    }
  }
  return index;
}

/**
 * An `await_protected_input` call, with what its card needs: the checkout,
 * the request, and the store the password is for. The store comes from the
 * watch that handed the request back, else the checkout's own site, never
 * from the model's arguments: the password is bound to it.
 */
export function passwordRequestOf(
  part: ChatMessagePart,
  watches: WatchIndex,
): { checkoutId: string; requestId: string; domain: string } | undefined {
  if (part.type !== "tool-await_protected_input" || part.state === "input-streaming")
    return undefined;
  const requestId = part.input?.requestId;
  const known = requestId ? watches.passwords.get(requestId) : undefined;
  if (!requestId || !known) return undefined;
  const domain = known.domain ?? watches.sites.get(known.checkoutId)?.host;
  return domain ? { checkoutId: known.checkoutId, requestId, domain } : undefined;
}

/**
 * One stretch of a checkout as steps, for its card: each update the store's
 * agent wrote, the newest still in progress while the run goes on, then how
 * the run ended. A stretch that stopped for the user (a question, the payment
 * step) adds nothing: the agent asks in a bubble of its own below the card.
 */
/** True when a stretch stopped for the user: its card folds to the title, and the agent asks below. */
export function stoppedForUser(outcome: CheckoutOutcome | undefined): boolean {
  return (
    outcome?.status === "awaiting_input" ||
    outcome?.status === "awaiting_payment" ||
    outcome?.status === "awaiting_password"
  );
}

export function runSteps(opts: {
  updates: CheckoutUpdate[];
  host: string;
  /** The run is still going in this stretch. */
  live: boolean;
  /** A stretch after an answer, not the start. */
  continuing: boolean;
  outcome?: CheckoutOutcome;
}): CheckoutStep[] {
  const steps: CheckoutStep[] = opts.updates.map((u) => ({ key: u.id, label: u.text, state: "done" }));
  if (opts.live) {
    const last = steps.at(-1);
    if (last) last.state = "active";
    else
      steps.push({
        key: "start",
        label: opts.continuing ? "Picking up where it left off" : `Opening ${opts.host}`,
        state: "active",
      });
    return steps;
  }
  const out = opts.outcome;
  if (!out) return steps;
  switch (out.status) {
    case "awaiting_input":
    case "awaiting_payment":
      break;
    case "succeeded":
      steps.push({
        key: "done",
        label: out.total ? `Done: ${out.total.amount} ${out.total.currency}` : "Done",
        state: "done",
      });
      break;
    default:
      steps.push({
        key: "stopped",
        label: out.status === "cancelled" ? "Cancelled" : (out.failure?.message ?? out.summary ?? "Stopped"),
        state: "failed",
      });
  }
  return steps;
}

/** The line a look-up puts above its cards, once the call is streamed in. */
export function productsMessageOf(part: ChatMessagePart): string | undefined {
  if (part.type !== "tool-look_up_products" || part.state === "input-streaming") return undefined;
  const message = (part.input as { message?: string } | undefined)?.message?.trim();
  return message || undefined;
}

/** The products a search or a look-up found, once it has, for the cards. */
export function productsOf(part: ChatMessagePart): FoundProduct[] | undefined {
  if (part.type !== "tool-search_products" && part.type !== "tool-look_up_products") return undefined;
  if (part.state !== "output-available") return undefined;
  const out = part.output as { products?: FoundProduct[] } | ToolError;
  return isToolError(out) ? undefined : out.products;
}

/** The line the agent puts above a receipt, once the call is streamed in. */
export function receiptMessageOf(part: ChatMessagePart): string | undefined {
  if (part.type !== "tool-show_receipt" || part.state === "input-streaming") return undefined;
  const message = (part.input as { message?: string } | undefined)?.message?.trim();
  return message || undefined;
}

/** The receipt a `show_receipt` call sends, once the checkout has vouched for it. */
export function receiptOf(part: ChatMessagePart): ReceiptData | undefined {
  if (part.type !== "tool-show_receipt" || part.state !== "output-available") return undefined;
  const out = part.output as ShownReceipt | ToolError;
  if (isToolError(out)) return undefined;
  const money = (value: string) => formatAmount(value, out.currency);
  return {
    kind: out.kind,
    merchant: out.merchant,
    ...(out.host ? { host: out.host } : {}),
    ...(out.reference ? { reference: out.reference } : {}),
    ...(out.title ? { title: out.title } : {}),
    ...(out.details?.length ? { details: out.details } : {}),
    ...(out.items?.length
      ? {
          items: out.items.map((i) => ({
            label: i.label,
            ...(i.amount ? { amount: money(i.amount) } : {}),
          })),
        }
      : {}),
    ...(out.total ? { total: formatAmount(out.total.amount, out.total.currency) } : {}),
    ...(out.paymentMethod
      ? {
          card: {
            label: paymentMethodLabel(out.paymentMethod),
            paymentMethod: out.paymentMethod,
          },
        }
      : {}),
  };
}

/** The site a `create_checkout` call visits, and what the agent does there, for its card. */
export interface CheckoutSite {
  checkoutId?: string;
  /** "smartsweets.com" */
  host: string;
  /** "Buying a pouch of Sweet Fish", as the model put it. */
  action?: string;
}

export function checkoutSiteOf(part: ChatMessagePart): CheckoutSite | undefined {
  if (part.type !== "tool-create_checkout") return undefined;
  const input = part.input as { startUrl?: string; action?: string } | undefined;
  if (!input?.startUrl) return undefined;
  let host: string;
  try {
    host = new URL(input.startUrl).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
  return { checkoutId: checkoutOf(part)?.id, host, action: input.action?.trim() || undefined };
}

/** The pending `watch_checkout` calls in a thread, for a surface that watches them out of sight. */
export function pendingWatches(messages: ChatMessage[]): Array<{ toolCallId: string; checkoutId: string }> {
  const out: Array<{ toolCallId: string; checkoutId: string }> = [];
  for (const m of messages) {
    for (const part of m.parts) {
      if (part.type === "tool-watch_checkout" && part.state === "input-available") {
        out.push({ toolCallId: part.toolCallId, checkoutId: part.input.checkoutId });
      }
    }
  }
  return out;
}

export const CHECKOUT_TITLES = {
  "tool-create_checkout": "Starting a checkout",
  "tool-get_checkout": "Checking the checkout",
  "tool-answer_checkout": "Answering the checkout",
  "tool-cancel_checkout": "Cancelling the checkout",
} as const;

export type CheckoutPartType = keyof typeof CHECKOUT_TITLES;

export function isCheckoutPart(part: ChatMessagePart): part is Extract<ChatMessagePart, { type: CheckoutPartType }> {
  return part.type in CHECKOUT_TITLES;
}

/** The checkout a tool part carries, once it has one. */
export function checkoutOf(part: ChatMessagePart): CheckoutView | undefined {
  if (!isCheckoutPart(part) || part.state !== "output-available") return undefined;
  const output = part.output as CheckoutView | ToolError;
  return isToolError(output) ? undefined : output;
}

/**
 * The checkout waiting on this approval, when the request came from a
 * checkout's payment step rather than a bare `request_agent_card`. It lets a
 * surface say the user is choosing how to pay for something already in front
 * of them, rather than granting a budget out of the blue.
 */
export function findPaymentStep(message: ChatMessage, requestId: string): CheckoutView | undefined {
  for (const part of message.parts) {
    const view = checkoutOf(part);
    if (view?.paymentRequest?.requestId === requestId) return view;
  }
  return undefined;
}

/** "Looking at your saved cards", the line a phone shows while a tool runs. */
export function toolTitle(type: string): string {
  const titles: Record<string, string> = {
    "tool-list_payment_methods": "Looking at your saved cards",
    "tool-list_agent_cards": "Looking at your agent cards",
    "tool-get_agent_card": "Checking an agent card",
    "tool-request_agent_card": "Requesting an agent card",
    "tool-await_agent_card_approval": "Waiting for your approval",
    "tool-await_protected_input": "Waiting for your password",
    "tool-watch_checkout": "Following the checkout",
    "tool-pay_checkout_with_agent_card": "Paying with your agent card",
    "tool-save_buyer_profile": "Saving your details for next time",
    "tool-search_products": "Looking through online stores",
    "tool-look_up_products": "Looking the product up",
    "tool-show_receipt": "Writing up the receipt",
    "tool-reveal_agent_card": "Minting a card credential",
    "tool-revoke_agent_card": "Revoking an agent card",
    ...CHECKOUT_TITLES,
  };
  return titles[type] ?? humanizeToolName(type.replace(/^tool-/, ""));
}

/** The checkout's state in a few words. */
export function checkoutStatusLine(view: CheckoutView): string {
  if (view.failure) {
    const head = view.status === "blocked" ? "Stopped" : view.status === "cancelled" ? "Cancelled" : "Failed";
    return `${head}: ${view.failure.message ?? view.failure.reason}`;
  }
  if (view.paymentRequest) return "Waiting for you to choose a payment method";
  if (view.rendered) return `Waiting for input: ${view.rendered.title}`;
  if (view.status === "succeeded") return `Bought${view.receipt ? ` for ${view.receipt.total.amount} ${view.receipt.total.currency}` : ""}`;
  return view.status.replace(/_/g, " ");
}

export function checkoutBadgeVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  switch (status) {
    case "succeeded":
      return "success";
    case "blocked":
    case "failed":
    case "cancelled":
      return "destructive";
    case "awaiting_input":
      return "warning";
    default:
      return "muted";
  }
}

/**
 * The store a checkout runs at, for a link bubble or a card header:
 * "nike.com". Only the `create_checkout` call carries the URL, so a later
 * `watch_checkout` or `get_checkout` part looks for the create call with the
 * same checkout id in the same message.
 */
export function checkoutHost(message: ChatMessage, part: ChatMessagePart): string | undefined {
  const url = startUrlOf(part) ?? startUrlOf(createPartFor(message, checkoutIdOf(part)));
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function startUrlOf(part: ChatMessagePart | undefined): string | undefined {
  if (!part || part.type !== "tool-create_checkout") return undefined;
  const input = part.input as { startUrl?: string } | undefined;
  return input?.startUrl;
}

function checkoutIdOf(part: ChatMessagePart): string | undefined {
  if (part.type === "tool-watch_checkout") return part.input?.checkoutId;
  const view = checkoutOf(part);
  if (view) return view.id;
  if (isCheckoutPart(part) && part.type !== "tool-create_checkout") return (part.input as { checkoutId?: string } | undefined)?.checkoutId;
  return undefined;
}

function createPartFor(message: ChatMessage, checkoutId: string | undefined): ChatMessagePart | undefined {
  if (!checkoutId) return undefined;
  return message.parts.find((p) => p.type === "tool-create_checkout" && checkoutOf(p)?.id === checkoutId);
}

/** The plain text of a message, for bubbles and copy buttons. */
export function messageText(message: ChatMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

/** True while the part's tool is still running. */
export function toolBusy(state: string): boolean {
  return state === "input-streaming" || state === "input-available" || state === "approval-requested";
}
