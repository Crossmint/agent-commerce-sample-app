import type {
  Checkout,
  CheckoutMessage,
  CheckoutResult,
  InputResponsePart,
  PendingUserAction,
  ResultPart,
} from "./types.js";

/*
 * Helpers for the message model of Agent Checkouts. A caller answers an
 * input request by sending a message with one `input_response` part that
 * names the `requestId`; free text goes in a `text` part.
 */

/** A unique message id. Crossmint applies a retried id once, so keep it per answer. */
export function newMessageId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function submitResponse(requestId: string, values: Record<string, unknown>): InputResponsePart {
  return { type: "input_response", requestId, action: "submit", response: { kind: "form", values } };
}

/**
 * The answer to a payment input request: the id of an order intent the user
 * authorized for the amount the request states. Never card details, which
 * Agent Checkouts refuses; the checkout mints the credential itself.
 */
export function paymentResponse(requestId: string, orderIntentId: string): InputResponsePart {
  return { type: "input_response", requestId, action: "submit", response: { kind: "payment", orderIntentId } };
}

export function declineResponse(requestId: string): InputResponsePart {
  return { type: "input_response", requestId, action: "decline" };
}

export function alternativeResponse(requestId: string, text: string): InputResponsePart {
  return { type: "input_response", requestId, action: "alternative", text };
}

/**
 * The run's open question as a flat action, or undefined when nothing is
 * pending. `id` is the `requestId` to answer with.
 */
export function pendingActionOf(checkout: Pick<Checkout, "status" | "requiredAction">): PendingUserAction | undefined {
  const ra = checkout.requiredAction;
  if (!ra || checkout.status !== "awaiting_input") return undefined;
  const req = ra.request;
  const interaction = req.interaction;
  return {
    id: ra.requestId,
    messageId: ra.messageId,
    question: req.question,
    expiresAt: req.expiresAt,
    responseSchema: interaction?.responseSchema ?? {},
    uiSchema: interaction?.uiSchema,
    ...(interaction?.kind === "payment"
      ? {
          payment: {
            method: interaction.method ?? "card",
            ...(interaction.amount ? { amount: interaction.amount } : {}),
            ...(interaction.merchant ? { merchant: interaction.merchant } : {}),
          },
        }
      : {}),
  };
}

/** The receipt of a succeeded run, when the agent could read one. */
export function receiptOf(checkout: Pick<Checkout, "result">): { total: { amount: string; currency: string }; merchantOrderId?: string } | undefined {
  const p = checkout.result?.purchase;
  return p && p.kind === "receipt_captured" ? p.receipt : undefined;
}

/** The last `result` part in a transcript, where `failed` runs put their summary. */
export function lastResult(messages: CheckoutMessage[]): CheckoutResult | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i]?.parts ?? [];
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j];
      if (part && part.type === "result") {
        const { type: _type, ...rest } = part as ResultPart;
        return rest;
      }
    }
  }
  return undefined;
}
