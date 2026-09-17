import { tool } from "ai";
import { describeTool, PARAM_DOCS, paramDoc, type ToolNameFor } from "@goat-wallet/core";
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
 *
 * Descriptions: the shared facts come from `TOOL_DOCS` in core (the MCP
 * server uses the same ones); this file adds the chat-specific sentence,
 * such as approving inline instead of through a link.
 */

/** The tools the chat offers. Adding or removing one here must match `TOOL_DOCS` surfaces. */
type ChatTools = Record<ToolNameFor<"chat">, unknown>;

const amountSchema = z.object({
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Decimal string like "50.00"').describe('Decimal string, e.g. "50.00".'),
  currency: z.string().length(3).describe(PARAM_DOCS.currency),
});

const merchantSchema = z
  .object({
    name: z.string().min(1).describe(PARAM_DOCS.merchantName),
    url: z.string().min(1).describe(PARAM_DOCS.merchantUrl),
    countryCode: z.string().length(2).describe(PARAM_DOCS.merchantCountryCode),
  })
  .describe(PARAM_DOCS.merchant);

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
      description: describeTool("list_payment_methods"),
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
      description: describeTool("list_agent_cards"),
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => ({ agentCards: (await goat.listAgentCards()).map(summarizeAgentCard) })),
    }),

    get_agent_card: tool({
      description: describeTool("get_agent_card"),
      inputSchema: z.object({ agentCardId: z.string().min(1).describe(paramDoc("get_agent_card", "agentCardId")) }),
      execute: ({ agentCardId }) => guard(async () => summarizeAgentCard(await goat.getAgentCard(agentCardId))),
    }),

    request_agent_card: tool({
      description: describeTool(
        "request_agent_card",
        "Immediately after, call await_agent_card_approval with that requestId so the user can approve in the chat.",
      ),
      inputSchema: z.object({
        amount: amountSchema.describe(paramDoc("request_agent_card", "amount")),
        description: z.string().min(1).max(200).describe(paramDoc("request_agent_card", "description")),
        merchant: merchantSchema.optional().describe(paramDoc("request_agent_card", "merchant")),
        expiresInHours: z.number().positive().max(24 * 30).optional().describe(paramDoc("request_agent_card", "expiresInHours")),
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
      description: describeTool("await_agent_card_approval"),
      inputSchema: z.object({ requestId: z.string().min(1).describe(paramDoc("await_agent_card_approval", "requestId")) }),
      outputSchema: approvalOutcomeSchema,
    }),

    reveal_agent_card: tool({
      description: describeTool("reveal_agent_card", "Returns only a masked summary: the full number never enters the chat."),
      inputSchema: z.object({
        agentCardId: z.string().min(1).describe(paramDoc("reveal_agent_card", "agentCardId")),
        amount: amountSchema.optional().describe(paramDoc("reveal_agent_card", "amount")),
        merchant: merchantSchema.optional().describe(paramDoc("reveal_agent_card", "merchant")),
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

    revoke_agent_card: tool({
      description: describeTool("revoke_agent_card"),
      inputSchema: z.object({ agentCardId: z.string().min(1).describe(paramDoc("revoke_agent_card", "agentCardId")) }),
      execute: ({ agentCardId }) =>
        guard(async () => {
          await goat.revokeAgentCard(agentCardId);
          return { agentCardId, revoked: true };
        }),
    }),

    create_checkout: tool({
      description: describeTool("create_checkout"),
      inputSchema: z.object({
        startUrl: z.string().url().describe(paramDoc("create_checkout", "startUrl")),
        task: z.string().max(20000).optional().describe(paramDoc("create_checkout", "task")),
        agentCardId: z.string().min(1).describe(paramDoc("create_checkout", "agentCardId")),
        maxCost: z
          .object({
            amount: z.string().regex(/^\d+(\.\d{1,2})?$/).describe('Decimal string, e.g. "50.00".'),
            currency: z.string().length(3).describe(PARAM_DOCS.currency),
          })
          .describe(paramDoc("create_checkout", "maxCost")),
        buyerProfileId: z.string().min(1).optional().describe(paramDoc("create_checkout", "buyerProfileId")),
      }),
      execute: (input) => guard(() => goat.createCheckout(input)),
    }),

    get_checkout: tool({
      description: describeTool("get_checkout"),
      inputSchema: z.object({ checkoutId: z.string().min(1).describe(paramDoc("get_checkout", "checkoutId")) }),
      execute: ({ checkoutId }) => guard(() => goat.getCheckout(checkoutId)),
    }),

    answer_checkout: tool({
      description: describeTool("answer_checkout"),
      inputSchema: z.object({
        checkoutId: z.string().min(1).describe(paramDoc("answer_checkout", "checkoutId")),
        requestId: z.string().min(1).optional().describe(paramDoc("answer_checkout", "requestId")),
        action: z.enum(["submit", "decline", "alternative"]).optional().describe(paramDoc("answer_checkout", "action")),
        values: z.record(z.string(), z.unknown()).optional().describe(paramDoc("answer_checkout", "values")),
        text: z.string().max(20000).optional().describe(paramDoc("answer_checkout", "text")),
      }),
      execute: ({ checkoutId, ...input }) => guard(() => goat.answerCheckout(checkoutId, input)),
    }),

    cancel_checkout: tool({
      description: describeTool("cancel_checkout"),
      inputSchema: z.object({ checkoutId: z.string().min(1).describe(paramDoc("cancel_checkout", "checkoutId")) }),
      execute: ({ checkoutId }) => guard(() => goat.cancelCheckout(checkoutId)),
    }),
  } satisfies ChatTools;
}

export type ChatToolSet = ReturnType<typeof createChatTools>;
export type ChatToolName = keyof ChatToolSet;
