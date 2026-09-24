import { tool } from "ai";
import { describeTool, PARAM_DOCS, paramDoc, type ToolNameFor } from "@agent-commerce/core";
import { z } from "zod";
import { CHAT_REQUESTER } from "./config";
import { AgentCommerceToolError, type AgentCommerceClient } from "./api-client";
import { lookUpProducts, searchProducts } from "./shopify-catalog";

/**
 * Agent Commerce tools for the chat model. Every tool runs in process against the Agent Commerce
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
 * `watch_checkout` works the same way for a stretch of a checkout. The client
 * polls the run and posts each update the store's agent writes as a chat
 * message, then hands back when the store asks a question, the run reaches
 * its payment step, or it ends. The model asks the question in words, or asks
 * how to pay, sends the answer, and watches again. It never polls itself.
 *
 * Descriptions: the shared facts come from `TOOL_DOCS` in core (the MCP
 * server uses the same ones); this file adds the chat-specific sentence,
 * such as approving inline instead of through a link.
 */

/** The tools the chat offers. Adding or removing one here must match `TOOL_DOCS` surfaces. */
type ChatTools = Record<ToolNameFor<"chat">, unknown>;

const amountSchema = z.object({
  value: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Decimal string like "50.00"')
    .describe('Decimal string, e.g. "50.00".'),
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

/** One thing the store's agent wrote while a checkout ran, shown to the user as a chat message. */
export const checkoutUpdateSchema = z.object({ id: z.string(), text: z.string() });
export type CheckoutUpdate = z.infer<typeof checkoutUpdateSchema>;

/**
 * Why `watch_checkout` returned: the store asked a question, the run reached
 * its payment step, or it ended. `updates` are what the chat showed the user
 * meanwhile, so history keeps them and the model knows what was said.
 */
export const checkoutOutcomeSchema = z.object({
  checkoutId: z.string(),
  status: z.enum([
    "succeeded",
    "blocked",
    "failed",
    "cancelled",
    "awaiting_input",
    "awaiting_payment",
  ]),
  updates: z.array(checkoutUpdateSchema),
  /** When the chat started and stopped following this stretch, ISO 8601: its card shows how long it took. */
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  /** On `awaiting_input`: what the store asks, and the JSON Schema the answer must fit. */
  question: z
    .object({
      requestId: z.string(),
      question: z.string(),
      expiresAt: z.string().optional(),
      responseSchema: z.record(z.string(), z.unknown()),
    })
    .optional(),
  /**
   * On `awaiting_payment`: the payment step. `requestId` is what
   * await_agent_card_approval takes when the user wants a new agent card;
   * `amount` is what the run asks to be paid: the payable total, or the run's ceiling when it cannot tell yet.
   */
  payment: z
    .object({
      requestId: z.string(),
      status: z.string(),
      amount: z.object({ value: z.string(), currency: z.string() }),
      description: z.string(),
      merchant: z.object({ name: z.string(), url: z.string() }).optional(),
    })
    .optional(),
  total: z.object({ amount: z.string(), currency: z.string() }).optional(),
  merchantOrderId: z.string().optional(),
  summary: z.string().optional(),
  failure: z.object({ reason: z.string(), message: z.string().optional() }).optional(),
});
export type CheckoutOutcome = z.infer<typeof checkoutOutcomeSchema>;

/** Turn a Agent Commerce API error into a plain tool result the model can read and explain. */
async function guard<T>(fn: () => Promise<T>): Promise<T | { error: string; code: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AgentCommerceToolError) return { error: e.message, code: e.code };
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
    activeRails: card.rails
      .filter((r) => r.status === "active")
      .map((r) => (r.provider ? `${r.rail}:${r.provider}` : r.rail)),
    merchant: card.merchant ? { name: card.merchant.name, url: card.merchant.url } : undefined,
  };
}

export function createChatTools(api: AgentCommerceClient, opts: { userEmail?: string } = {}) {
  return {
    list_payment_methods: tool({
      description: describeTool("list_payment_methods"),
      inputSchema: z.object({}),
      execute: () =>
        guard(async () => {
          const cards = await api.listPaymentMethods();
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
        guard(async () => ({ agentCards: (await api.listAgentCards()).map(summarizeAgentCard) })),
    }),

    get_agent_card: tool({
      description: describeTool("get_agent_card"),
      inputSchema: z.object({
        agentCardId: z.string().min(1).describe(paramDoc("get_agent_card", "agentCardId")),
      }),
      execute: ({ agentCardId }) =>
        guard(async () => summarizeAgentCard(await api.getAgentCard(agentCardId))),
    }),

    request_agent_card: tool({
      description: describeTool(
        "request_agent_card",
        "Immediately after, call await_agent_card_approval with that requestId so the user can approve in the chat.",
      ),
      inputSchema: z.object({
        amount: amountSchema.describe(paramDoc("request_agent_card", "amount")),
        description: z
          .string()
          .min(1)
          .max(200)
          .describe(paramDoc("request_agent_card", "description")),
        merchant: merchantSchema.optional().describe(paramDoc("request_agent_card", "merchant")),
        expiresInHours: z
          .number()
          .positive()
          .max(24 * 30)
          .optional()
          .describe(paramDoc("request_agent_card", "expiresInHours")),
      }),
      execute: (input) =>
        guard(async () => {
          const req = await api.createAgentCardRequest({ ...input, requester: CHAT_REQUESTER });
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
      inputSchema: z.object({
        requestId: z.string().min(1).describe(paramDoc("await_agent_card_approval", "requestId")),
      }),
      outputSchema: approvalOutcomeSchema,
    }),

    reveal_agent_card: tool({
      description: describeTool(
        "reveal_agent_card",
        "Returns only a masked summary: the full number never enters the chat.",
      ),
      inputSchema: z.object({
        agentCardId: z.string().min(1).describe(paramDoc("reveal_agent_card", "agentCardId")),
        amount: amountSchema.optional().describe(paramDoc("reveal_agent_card", "amount")),
        merchant: merchantSchema.optional().describe(paramDoc("reveal_agent_card", "merchant")),
      }),
      execute: ({ agentCardId, ...rest }) =>
        guard(async () => {
          const result = await api.mintCredentials(agentCardId, rest);
          return {
            agentCardId: result.agentCardId,
            rail: result.rail,
            provider: result.provider,
            enforced: result.enforced,
            card: result.card
              ? {
                  last4: result.card.number.slice(-4),
                  expirationMonth: result.card.expirationMonth,
                  expirationYear: result.card.expirationYear,
                }
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
      inputSchema: z.object({
        agentCardId: z.string().min(1).describe(paramDoc("revoke_agent_card", "agentCardId")),
      }),
      execute: ({ agentCardId }) =>
        guard(async () => {
          await api.revokeAgentCard(agentCardId);
          return { agentCardId, revoked: true };
        }),
    }),

    create_checkout: tool({
      description: describeTool(
        "create_checkout",
        "Then call watch_checkout with the checkoutId, with no text in between.",
      ),
      inputSchema: z.object({
        startUrl: z.string().url().describe(paramDoc("create_checkout", "startUrl")),
        // Chat only, and never sent to the API: the line the site card shows.
        action: z
          .string()
          .min(1)
          .max(60)
          .optional()
          .describe(
            "What you are doing on the site, in a few words, shown to the user on the site card. Start with a verb. E.g. Buying a pouch of Sweet Fish, Booking a table for 2 at Nopa, Getting tickets for a show in Madrid.",
          ),
        task: z.string().max(20000).optional().describe(paramDoc("create_checkout", "task")),
        agentCardId: z
          .string()
          .min(1)
          .optional()
          .describe(paramDoc("create_checkout", "agentCardId")),
        maxCost: z
          .object({
            amount: z
              .string()
              .regex(/^\d+(\.\d{1,2})?$/)
              .describe('Decimal string, e.g. "50.00".'),
            currency: z.string().length(3).describe(PARAM_DOCS.currency),
          })
          .describe(paramDoc("create_checkout", "maxCost")),
        buyerProfileId: z
          .string()
          .min(1)
          .optional()
          .describe(paramDoc("create_checkout", "buyerProfileId")),
        purpose: z.string().min(1).max(80).describe(paramDoc("create_checkout", "purpose")),
      }),
      execute: ({ action, ...input }) => {
        void action; // for the site card only
        // The store's agent asks for an email on most checkouts. Give it the
        // user's up front, so nobody is asked for what the app already knows.
        const task =
          opts.userEmail && !input.task?.includes(opts.userEmail)
            ? [input.task, `The buyer's email is ${opts.userEmail}.`].filter(Boolean).join(" ")
            : input.task;
        return guard(() => api.createCheckout({ ...input, ...(task ? { task } : {}) }));
      },
    }),

    // Client-side tool: no `execute`. The chat UI shows the run live and supplies the output when it ends.
    watch_checkout: tool({
      description: describeTool("watch_checkout"),
      inputSchema: z.object({
        checkoutId: z.string().min(1).describe(paramDoc("watch_checkout", "checkoutId")),
      }),
      outputSchema: checkoutOutcomeSchema,
    }),

    get_checkout: tool({
      description: describeTool(
        "get_checkout",
        "In this chat you rarely need it: watch_checkout follows the run for you. Use it for a checkout from an earlier conversation.",
      ),
      inputSchema: z.object({
        checkoutId: z.string().min(1).describe(paramDoc("get_checkout", "checkoutId")),
      }),
      execute: ({ checkoutId }) => guard(() => api.getCheckout(checkoutId)),
    }),

    search_products: tool({
      description: describeTool(
        "search_products",
        "The chat shows the results as cards with pictures; the user can open one for its details, and buy it with its Buy button. Do not repeat every detail in text.",
      ),
      inputSchema: z.object({
        query: z.string().min(2).max(200).describe(paramDoc("search_products", "query")),
        maxPrice: z
          .number()
          .positive()
          .optional()
          .describe(paramDoc("search_products", "maxPrice")),
        shipsTo: z.string().length(2).optional().describe(paramDoc("search_products", "shipsTo")),
      }),
      execute: (input) =>
        guard(async () => {
          const products = await searchProducts({ ...input, limit: 5 });
          return products.length
            ? { products }
            : { products, note: "Nothing found. Try other words, or ask the user for a link." };
        }),
    }),

    look_up_products: tool({
      description: describeTool(
        "look_up_products",
        "The chat shows them as cards with pictures, under your message; do not repeat every detail in text.",
      ),
      inputSchema: z.object({
        urls: z
          .array(z.string().url())
          .min(1)
          .max(5)
          .describe(paramDoc("look_up_products", "urls")),
        // Chat only: the line above the cards. It is part of the call, so it
        // always shows first, whatever order the model writes in.
        message: z
          .string()
          .min(1)
          .max(300)
          .optional()
          .describe(
            "What to say to the user about these products, shown right above them, e.g. a question about whether they want them. When you pass it, write no other text for them.",
          ),
      }),
      execute: ({ urls }) =>
        guard(async () => {
          const products = await lookUpProducts(urls);
          return products.length
            ? { products }
            : {
                products,
                note: "Not found in the catalog. Describe the product in words instead.",
              };
        }),
    }),

    save_buyer_profile: tool({
      description: describeTool("save_buyer_profile"),
      inputSchema: z.object({
        firstName: z.string().min(1).describe(paramDoc("save_buyer_profile", "firstName")),
        lastName: z.string().min(1).describe(paramDoc("save_buyer_profile", "lastName")),
        email: z.string().email().optional().describe(paramDoc("save_buyer_profile", "email")),
        phone: z.string().min(3).describe(paramDoc("save_buyer_profile", "phone")),
        addressLines: z
          .array(z.string().min(1))
          .min(1)
          .describe(paramDoc("save_buyer_profile", "addressLines")),
        city: z.string().min(1).describe(paramDoc("save_buyer_profile", "city")),
        region: z.string().min(2).optional().describe(paramDoc("save_buyer_profile", "region")),
        postalCode: z.string().min(1).describe(paramDoc("save_buyer_profile", "postalCode")),
        countryCode: z.string().length(2).describe(paramDoc("save_buyer_profile", "countryCode")),
        label: z
          .string()
          .min(1)
          .max(60)
          .optional()
          .describe(paramDoc("save_buyer_profile", "label")),
      }),
      execute: (input) =>
        guard(async () => {
          const email = input.email ?? opts.userEmail;
          if (!email) {
            return { error: "No email to save. Ask the user for one.", code: "invalid_request" };
          }
          const saved = await api.createBuyerProfile({
            label: input.label ?? "Home",
            name: { first: input.firstName, last: input.lastName },
            contact: { email, phone: input.phone },
            shipping: {
              addressLines: input.addressLines,
              locality: input.city,
              ...(input.region ? { administrativeAreaCode: input.region.toUpperCase() } : {}),
              postalCode: input.postalCode,
              countryCode: input.countryCode.toUpperCase(),
            },
          });
          return {
            buyerProfileId: saved.id,
            saved: true,
            note: "Later checkouts start with these details. The one running now already has its answers from you.",
          };
        }),
    }),

    pay_checkout_with_agent_card: tool({
      description: describeTool(
        "pay_checkout_with_agent_card",
        "Then call watch_checkout again, with no text in between.",
      ),
      inputSchema: z.object({
        checkoutId: z
          .string()
          .min(1)
          .describe(paramDoc("pay_checkout_with_agent_card", "checkoutId")),
        agentCardId: z
          .string()
          .min(1)
          .describe(paramDoc("pay_checkout_with_agent_card", "agentCardId")),
      }),
      execute: ({ checkoutId, agentCardId }) =>
        guard(() => api.setCheckoutAgentCard(checkoutId, agentCardId)),
    }),

    answer_checkout: tool({
      description: describeTool(
        "answer_checkout",
        "For a checkout you watch, call watch_checkout again right after, with no text in between.",
      ),
      inputSchema: z.object({
        checkoutId: z.string().min(1).describe(paramDoc("answer_checkout", "checkoutId")),
        requestId: z.string().min(1).optional().describe(paramDoc("answer_checkout", "requestId")),
        action: z
          .enum(["submit", "decline", "alternative"])
          .optional()
          .describe(paramDoc("answer_checkout", "action")),
        values: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(paramDoc("answer_checkout", "values")),
        text: z.string().max(20000).optional().describe(paramDoc("answer_checkout", "text")),
      }),
      execute: ({ checkoutId, ...input }) => guard(() => api.answerCheckout(checkoutId, input)),
    }),

    cancel_checkout: tool({
      description: describeTool("cancel_checkout"),
      inputSchema: z.object({
        checkoutId: z.string().min(1).describe(paramDoc("cancel_checkout", "checkoutId")),
      }),
      execute: ({ checkoutId }) => guard(() => api.cancelCheckout(checkoutId)),
    }),
  } satisfies ChatTools;
}

export type ChatToolSet = ReturnType<typeof createChatTools>;
