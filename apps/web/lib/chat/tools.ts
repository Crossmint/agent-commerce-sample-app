import { tool } from "ai";
import { z } from "zod";
import { CHAT_REQUESTER } from "./config";
import { GoatToolError, type GoatClient } from "./goat-client";

/**
 * GOAT tools for the chat model. Every tool runs in process against the GOAT
 * handlers with the user's own session JWT, so the model can do exactly what
 * the user could do from the wallet page, and nothing more.
 *
 * Human in the loop, two steps:
 * 1. `request_agent_card` has `execute`: it stores the request on the server
 *    and returns `{ requestId, approvalUrl }`. The request is what the wallet's
 *    /approve page also reads, so a reload never loses it.
 * 2. `await_agent_card_approval` has no `execute`. The AI SDK streams the tool
 *    call to the client and stops. The message renderer sees the part
 *    `tool-await_agent_card_approval` in state `input-available` and renders
 *    `<ApproveAgentCard requestId>` in its place. When the user allows or
 *    denies, the client calls `addToolOutput` with the outcome, and
 *    `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`
 *    resubmits so the model continues with the agentCardId.
 *
 * The outcome lives in the tool part, so history shows what happened, and the
 * model reads a real tool result instead of a synthetic user message.
 */

const amountSchema = z.object({
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Decimal string like "50.00"').describe("Decimal string, e.g. \"50.00\"."),
  currency: z.string().length(3).describe("ISO 4217 code, e.g. \"USD\"."),
});

const merchantSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1).describe("Merchant website, e.g. \"https://united.com\"."),
  countryCode: z.string().length(2).describe("Two-letter country code."),
});

export const approvalOutcomeSchema = z.object({
  status: z.enum(["active", "denied", "expired", "failed"]),
  agentCardId: z.string().optional(),
});
export type ApprovalOutcome = z.infer<typeof approvalOutcomeSchema>;

/** Turn a GOAT API error into a plain tool result the model can read and explain. */
async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string; code: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof GoatToolError) return { error: e.message, code: e.code };
    return { error: e instanceof Error ? e.message : "Unknown error", code: "internal" };
  }
}

function summarizeAgentCard(card: {
  orderIntentId: string;
  description: string;
  status: string;
  expiresAt: string;
  amount: { currency: string; total: string; available: string; spent: string };
  rails: Array<{ rail: string; status: string; provider?: string }>;
  merchant?: { name: string; url: string };
}) {
  return {
    agentCardId: card.orderIntentId,
    description: card.description,
    status: card.status,
    expiresAt: card.expiresAt,
    currency: card.amount.currency,
    total: card.amount.total,
    available: card.amount.available,
    spent: card.amount.spent,
    activeRails: card.rails.filter((r) => r.status === "active").map((r) => r.provider ? `${r.rail}:${r.provider}` : r.rail),
    merchant: card.merchant ? { name: card.merchant.name, url: card.merchant.url } : undefined,
  };
}

export function createChatTools(goat: GoatClient) {
  return {
    list_payment_methods: tool({
      description: "List the user's saved cards. Masked: brand, last four digits, expiry. Never a full number.",
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => {
          const cards = await goat.listPaymentMethods();
          return {
            paymentMethods: cards.map((pm) => ({
              paymentMethodId: pm.paymentMethodId,
              brand: pm.card?.brand,
              last4: pm.card?.last4,
              expiration: pm.card?.expiration,
              default: pm.default ?? false,
            })),
          };
        }),
    }),

    list_agent_cards: tool({
      description:
        "List the user's agent cards (approved budgets) with status, total, available balance and expiry. Call this before requesting a new one.",
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => ({ agentCards: (await goat.listAgentCards()).map(summarizeAgentCard) })),
    }),

    get_agent_card: tool({
      description: "Get one agent card by id: balance, status, rails, expiry.",
      inputSchema: z.object({ agentCardId: z.string().min(1) }),
      execute: ({ agentCardId }) => guard(async () => summarizeAgentCard(await goat.getAgentCard(agentCardId))),
    }),

    request_agent_card: tool({
      description:
        "Ask the user to approve a new agent card: a budget on one of their saved cards. Returns a requestId. Immediately after, call await_agent_card_approval with that requestId so the user can approve in the chat.",
      inputSchema: z.object({
        amount: amountSchema,
        description: z.string().min(1).max(200).describe("What the money is for, in the user's words. Shown on the approval screen."),
        merchant: merchantSchema.optional().describe("Lock the card to one merchant when the store is known."),
        expiresInHours: z.number().positive().max(24 * 30).optional().describe("Default 24."),
      }),
      execute: (input) =>
        guard(async () => {
          const req = await goat.createAgentCardRequest({ ...input, requester: CHAT_REQUESTER });
          return {
            requestId: req.id,
            approvalUrl: req.approvalUrl,
            status: req.status,
            amount: req.amount,
            description: req.description,
            merchant: req.merchant,
            expiresAt: req.expiresAt,
            requestExpiresAt: req.requestExpiresAt,
            next: "Call await_agent_card_approval with this requestId now. Do not write text first.",
          };
        }),
    }),

    // Client-side tool: no `execute`. The chat UI supplies the output after the user answers.
    await_agent_card_approval: tool({
      description:
        "Wait for the user to approve or deny an agent card request in the chat. Call it right after request_agent_card. The result carries the agentCardId when approved.",
      inputSchema: z.object({ requestId: z.string().min(1) }),
      outputSchema: approvalOutcomeSchema,
    }),

    reveal_agent_card: tool({
      description:
        "Mint a scoped card credential from an active agent card. Returns only a masked summary: the full number never enters the chat. Use create_checkout instead when the target is a website. Check `enforced`: false means the limit is advisory on that rail.",
      inputSchema: z.object({
        agentCardId: z.string().min(1),
        amount: amountSchema.optional().describe("Cap for this credential. Defaults to the agent card's remaining balance."),
        merchant: merchantSchema.optional(),
      }),
      execute: ({ agentCardId, ...rest }) =>
        guard(async () => {
          const result = await goat.mintCredentials(agentCardId, rest);
          return {
            agentCardId: result.agentCardId,
            rail: result.rail,
            provider: result.provider,
            enforced: result.enforced,
            card: result.card
              ? { last4: result.card.number.slice(-4), expirationMonth: result.card.expirationMonth, expirationYear: result.card.expirationYear }
              : undefined,
            expiresAt: result.expiresAt,
            warning: result.enforced
              ? undefined
              : "This rail does not enforce the limit. The amount is advisory. Prefer create_checkout, where maxCost is enforced.",
            note: "The card number was minted but is not shown in the chat. The user can see it from their wallet or the CLI.",
          };
        }),
    }),

    create_checkout: tool({
      description:
        "Start a Crossmint Agent Checkout at a product URL, paid with an agent card. Crossmint drives the store's checkout in a real browser; maxCost is a hard cap. Returns the checkout id. Follow it with get_checkout every few seconds.",
      inputSchema: z.object({
        startUrl: z.string().url().describe("Product or cart page URL."),
        task: z.string().max(20000).optional().describe('What to buy and how, e.g. "size M, black, cheapest shipping". The more you say, the fewer questions the agent asks.'),
        agentCardId: z.string().min(1),
        maxCost: z.object({
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
          currency: z.string().length(3),
        }),
        buyerProfileId: z.string().min(1).optional().describe("Saved buyer profile (name, contact, shipping)."),
      }),
      execute: (input) => guard(() => goat.createCheckout(input)),
    }),

    get_checkout: tool({
      description:
        "Get a checkout: status (queued, running, awaiting_input, succeeded, blocked, failed, cancelled), the open question with its fields, the live browser URL, and the receipt or failure when done.",
      inputSchema: z.object({ checkoutId: z.string().min(1) }),
      execute: ({ checkoutId }) => guard(() => goat.getCheckout(checkoutId)),
    }),

    answer_checkout: tool({
      description:
        "Answer a checkout's open question. Pass requestId with values keyed by field name to submit, action decline to refuse, or action alternative with text to suggest another way. Without requestId, text is a note to the agent. Never send card fields: the server pays.",
      inputSchema: z.object({
        checkoutId: z.string().min(1),
        requestId: z.string().min(1).optional(),
        action: z.enum(["submit", "decline", "alternative"]).optional(),
        values: z.record(z.string(), z.unknown()).optional(),
        text: z.string().max(20000).optional(),
      }),
      execute: ({ checkoutId, ...input }) => guard(() => goat.answerCheckout(checkoutId, input)),
    }),

    cancel_checkout: tool({
      description: "Stop a running checkout. It reaches cancelled on a later get_checkout.",
      inputSchema: z.object({ checkoutId: z.string().min(1) }),
      execute: ({ checkoutId }) => guard(() => goat.cancelCheckout(checkoutId)),
    }),
  };
}

export type ChatToolSet = ReturnType<typeof createChatTools>;
export type ChatToolName = keyof ChatToolSet;
