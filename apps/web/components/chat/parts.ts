import type { CheckoutView } from "@agent-commerce/server";
import type { ApproveOutcome } from "@agent-commerce/ui";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import type { ChatMessage, ChatMessagePart } from "@/lib/chat/types";
import { humanizeToolName } from "./tool-card";

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

export function approvalLabel(outcome: ApprovalOutcome): string {
  switch (outcome.status) {
    case "active":
      return "Approved. The agent card is active.";
    case "denied":
      return "Denied.";
    case "expired":
      return "The request expired.";
    default:
      return "The card could not be set up.";
  }
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

/** "Looking at your saved cards", the line a phone shows while a tool runs. */
export function toolTitle(type: string): string {
  const titles: Record<string, string> = {
    "tool-list_payment_methods": "Looking at your saved cards",
    "tool-list_agent_cards": "Looking at your agent cards",
    "tool-get_agent_card": "Checking an agent card",
    "tool-request_agent_card": "Requesting an agent card",
    "tool-await_agent_card_approval": "Waiting for your approval",
    "tool-reveal_agent_card": "Minting a card credential",
    "tool-revoke_agent_card": "Revoking an agent card",
    ...CHECKOUT_TITLES,
  };
  return titles[type] ?? humanizeToolName(type.replace(/^tool-/, ""));
}

/** One line under a finished tool call. */
export function toolSummary(type: string, output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const o = output as Record<string, unknown>;
  if (typeof o.error === "string") return o.error;
  switch (type) {
    case "tool-list_payment_methods": {
      const n = Array.isArray(o.paymentMethods) ? o.paymentMethods.length : 0;
      return n === 1 ? "1 saved card" : `${n} saved cards`;
    }
    case "tool-list_agent_cards": {
      const n = Array.isArray(o.agentCards) ? o.agentCards.length : 0;
      return n === 1 ? "1 agent card" : `${n} agent cards`;
    }
    case "tool-get_agent_card":
      return typeof o.available === "string" && typeof o.currency === "string" ? `${o.available} ${o.currency} available` : undefined;
    case "tool-reveal_agent_card":
      return o.enforced === false ? "Limit not enforced on this rail" : `Minted on ${String(o.rail ?? "a rail")}. Number not shown here.`;
    default:
      return undefined;
  }
}

/** The checkout's state in a few words. */
export function checkoutStatusLine(view: CheckoutView): string {
  if (view.failure) {
    const head = view.status === "blocked" ? "Stopped" : view.status === "cancelled" ? "Cancelled" : "Failed";
    return `${head}: ${view.failure.message ?? view.failure.reason}`;
  }
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
 * The store a checkout runs at, for a link bubble: "nike.com". Only the
 * `create_checkout` call carries the URL, so a later `get_checkout` part looks
 * for the create call with the same checkout id in the same message.
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
