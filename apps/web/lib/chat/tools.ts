import { tool, type ModelMessage } from "ai";
import {
  describeTool,
  PARAM_DOCS,
  buyerProfileProblems,
  normalizeBuyerProfile,
  paramDoc,
  type BuyerProfile,
  type BuyerProfileInput,
  type PaymentMethod,
  type ToolNameFor,
} from "@agent-commerce/core";
import { z } from "zod";
import { CHAT_REQUESTER } from "./config";
import { AgentCommerceToolError, type AgentCommerceClient } from "./api-client";
import { PAYMENT_CHOICE_METHODS } from "./payment-choice";
import { lookUpProducts, searchProducts } from "./shopify-catalog";
import { RECEIPT_KINDS, type ReceiptKind } from "@/lib/receipt";

/**
 * What every checkout tells the store's agent, so it does not stop to ask:
 * buy once, not on a subscription, and bill the shipping address. A task
 * that asks for a subscription says so, and wins.
 */
const PURCHASE_TERMS =
  "This is a one-time purchase: when the store offers a subscription or a repeat delivery (such as Subscribe and save), choose the one-time option, unless this task asks for a subscription. When the store asks for a billing address, use the shipping address: billing is the same as shipping.";

/**
 * Added to the task of a run that only changes a cart. The cart stays in the
 * user's browser profile at the store, so a later run can check it out.
 */
const CART_TERMS =
  "Only change the cart as this task asks. Do not check out and do not pay. When you are done, say what is in the cart now, with the prices and the cart total.";

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

/** What `await_saved_card` hands back: whether a card was saved, and which, by network and last four digits only. */
export const savedCardOutcomeSchema = z.object({
  status: z.enum(["saved", "cancelled"]),
  card: z.object({ paymentMethodId: z.string(), brand: z.string(), last4: z.string() }).optional(),
});
export type SavedCardOutcome = z.infer<typeof savedCardOutcomeSchema>;

/** What `await_protected_input` hands back: whether the user answered. Never a secret, never its id. */
export const protectedInputOutcomeSchema = z.object({
  status: z.enum(["submitted", "declined"]),
});
export type ProtectedInputOutcome = z.infer<typeof protectedInputOutcomeSchema>;

/**
 * What `await_buyer_details` hands back: whether the user saved their
 * details. The details reach the model in the system prompt of the next turn.
 */
export const buyerDetailsOutcomeSchema = z.object({
  status: z.enum(["saved", "skipped"]),
});
export type BuyerDetailsOutcome = z.infer<typeof buyerDetailsOutcomeSchema>;

/**
 * What `await_budget` hands back: the budget the user picked and approved,
 * or how it ended when it was not. `cancelled`: they closed it with Not now.
 * `other`: for a purchase, they want to pay another way, which the store's
 * payment step offers.
 */
export const budgetOutcomeSchema = z.object({
  status: z.enum(["active", "denied", "expired", "failed", "cancelled", "other"]),
  /** When active: the agent card to pay similar purchases from. */
  agentCardId: z.string().optional(),
  /** When active: a budget the user already had, picked again. */
  existing: z.boolean().optional(),
  /** The request the picker made: the chat draws its approval from it. */
  requestId: z.string().optional(),
  /** What the budget covers, as the user left it. */
  category: z.string().optional(),
  amount: z.object({ value: z.string(), currency: z.string() }).optional(),
  /** How many days the budget lasts. */
  days: z.number().optional(),
});
export type BudgetOutcome = z.infer<typeof budgetOutcomeSchema>;

/** What `await_payment_choice` hands back: how the user wants to pay, and the most it may cost. */
export const paymentChoiceOutcomeSchema = z.object({
  method: z.enum(PAYMENT_CHOICE_METHODS),
  /** For `agent_card`: the card to pay with, to pass to create_checkout. */
  agentCardId: z.string().optional(),
  /** For `agent_card`: a budget made just now, with this purchase as its first, and approved. */
  newCard: z.boolean().optional(),
  /** The request of the new card, when one was made: the chat draws its approval from it. */
  requestId: z.string().optional(),
  /** How the new card's approval ended. For `card`, it was not approved: ask how else to pay. */
  approval: z.enum(["active", "denied", "expired", "failed"]).optional(),
  /**
   * For `other`: the way the user typed, such as PayPal. Missing when they
   * did not say. For `agent_card`: what the card is for.
   */
  name: z.string().optional(),
  /**
   * The price with room for shipping and tax, when the price is known. For a
   * new card, the budget the user picked for it.
   */
  budget: z.object({ value: z.string(), currency: z.string() }).optional(),
  /** For a new card: how many days the budget lasts. */
  days: z.number().optional(),
});
export type PaymentChoiceOutcome = z.infer<typeof paymentChoiceOutcomeSchema>;

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
    "awaiting_protected_input",
  ]),
  updates: z.array(checkoutUpdateSchema),
  /** When the chat started and stopped following this stretch, ISO 8601: its card shows how long it took. */
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  /**
   * On `awaiting_input`: what the store asks, and the fields to answer, each
   * by its key: text, a number, true or false, or a choice's option values.
   */
  question: z
    .object({
      requestId: z.string(),
      question: z.string(),
      expiresAt: z.string().optional(),
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          required: z.boolean(),
          input: z.record(z.string(), z.unknown()),
        }),
      ),
      /** Set when the question asks for a password in a plain field, or card details in a form: never answered with values. */
      note: z.string().optional(),
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
  /**
   * On `awaiting_protected_input`: the store asks for secrets, such as the
   * password of the user's account there, named by label in `secrets`.
   * `requestId` is what await_protected_input takes. The secrets never reach
   * the chat.
   */
  protectedInput: z
    .object({
      requestId: z.string(),
      question: z.string(),
      secrets: z.array(z.string()),
      domain: z.string().optional(),
    })
    .optional(),
  total: z.object({ amount: z.string(), currency: z.string() }).optional(),
  merchantOrderId: z.string().optional(),
  summary: z.string().optional(),
  failure: z.object({ reason: z.string(), message: z.string().optional() }).optional(),
});
export type CheckoutOutcome = z.infer<typeof checkoutOutcomeSchema>;

/** Turn a Agent Commerce API error into a plain tool result the model can read and explain. */
type BuyerProfileChange = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  addressLines?: string[];
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  label?: string;
};

/**
 * The saved buyer details with a change laid over them: what the user said
 * now wins, and everything they did not mention is kept. Another country
 * drops the old state or province unless one came with it, so a move abroad
 * does not keep a region from the old country. Returns what is still missing
 * when there is no whole profile yet.
 */
export function mergeBuyerProfile(
  saved: BuyerProfile | null | undefined,
  change: BuyerProfileChange,
  userEmail?: string,
): { profile: BuyerProfileInput } | { missing: string[] } {
  const moved =
    Boolean(change.countryCode) &&
    change.countryCode!.toUpperCase() !== saved?.shipping.countryCode.toUpperCase();
  const first = change.firstName ?? saved?.name.first;
  const last = change.lastName ?? saved?.name.last;
  const email = change.email ?? saved?.contact.email ?? userEmail;
  const phone = change.phone ?? saved?.contact.phone;
  const addressLines = change.addressLines ?? saved?.shipping.addressLines;
  const city = change.city ?? saved?.shipping.locality;
  const region = change.region ?? (moved ? undefined : saved?.shipping.administrativeAreaCode);
  const postalCode = change.postalCode ?? saved?.shipping.postalCode;
  const countryCode = change.countryCode ?? saved?.shipping.countryCode;

  const missing = Object.entries({
    "first name": first,
    "last name": last,
    email,
    "phone number": phone,
    street: addressLines?.length ? addressLines : undefined,
    city,
    "postal code": postalCode,
    country: countryCode,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) return { missing };

  return {
    profile: {
      label: change.label ?? saved?.label ?? "Home",
      name: { first: first!, last: last! },
      contact: { email: email!, phone: phone! },
      shipping: {
        addressLines: addressLines!,
        locality: city!,
        ...(region ? { administrativeAreaCode: region.toUpperCase() } : {}),
        postalCode: postalCode!,
        countryCode: countryCode!.toUpperCase(),
      },
    },
  };
}

/** A receipt the chat draws: what the model said, and what the checkout verified. */
export interface ShownReceipt {
  kind: ReceiptKind;
  merchant: string;
  title?: string;
  details?: Array<{ label: string; value: string }>;
  items?: Array<{ label: string; amount?: string }>;
  /** The run's site: "opentable.com". */
  host?: string;
  reference?: string;
  total?: { amount: string; currency: string };
  /** The currency of the item amounts. */
  currency: string;
  paymentMethod?: PaymentMethod;
}

/** "www.opentable.com/r/nopa" → "opentable.com". */
function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

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

/**
 * True when the user closed the details form with Not now earlier in this
 * chat. Saved, and then deleted, is not a skip: the next purchase asks again.
 */
function skippedDetailsInChat(messages: ModelMessage[]): boolean {
  return messages.some(
    (m) =>
      m.role === "tool" &&
      m.content.some(
        (part) =>
          part.type === "tool-result" &&
          part.toolName === "await_buyer_details" &&
          part.output.type === "json" &&
          (part.output.value as Partial<BuyerDetailsOutcome> | null)?.status === "skipped",
      ),
  );
}

/**
 * How the user settled paying for the next checkout, from the newest
 * `await_budget` answer since the last checkout started: the budget to pay
 * from, or that it goes on with no budget (another way, Not now, or not
 * approved). Undefined when nothing is settled.
 */
function budgetPlanFor(messages: ModelMessage[]): { agentCardId?: string } | undefined {
  let plan: { agentCardId?: string } | undefined;
  for (const m of messages) {
    if (m.role !== "tool") continue;
    for (const part of m.content) {
      if (part.type !== "tool-result" || part.output.type !== "json") continue;
      const value = part.output.value as Record<string, unknown> | null;
      if (!value || typeof value !== "object") continue;
      if (part.toolName === "await_budget") {
        const outcome = budgetOutcomeSchema.safeParse(value);
        if (!outcome.success) continue;
        plan =
          outcome.data.status === "active" && outcome.data.agentCardId
            ? { agentCardId: outcome.data.agentCardId }
            : {};
      } else if (part.toolName === "create_checkout" && !("error" in value)) {
        // A checkout that started used the plan up.
        plan = undefined;
      }
    }
  }
  return plan;
}


/**
 * How the user chose to pay for the store a checkout starts at, as the chat
 * settled it: the newest payment choice for that store, and what happened
 * to the agent card since. Undefined when no choice is open: none was made,
 * it was for another store, or a checkout already started after it.
 */
interface CardPlan {
  choice: PaymentChoiceOutcome;
  /** The product page the choice was for. */
  url: string;
  /** A request for a new agent card, made since the choice. */
  requestId?: string;
  /** The agent card approved since the choice: the one to pay with. */
  approved?: string;
  /** The user turned the new agent card down. */
  refused?: boolean;
}

function cardPlanFor(messages: ModelMessage[], startUrl: string): CardPlan | undefined {
  const choiceUrls = new Map<string, string>();
  let plan: CardPlan | undefined;
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part.type !== "tool-call" || part.toolName !== "await_payment_choice") continue;
        const url = (part.input as { url?: unknown } | undefined)?.url;
        if (typeof url === "string") choiceUrls.set(part.toolCallId, url);
      }
    }
    if (m.role !== "tool") continue;
    for (const part of m.content) {
      if (part.type !== "tool-result" || part.output.type !== "json") continue;
      const value = part.output.value as Record<string, unknown> | null;
      if (!value || typeof value !== "object") continue;
      if (part.toolName === "await_payment_choice") {
        const choice = paymentChoiceOutcomeSchema.safeParse(value);
        const url = choiceUrls.get(part.toolCallId);
        plan = choice.success && url ? { choice: choice.data, url } : undefined;
        continue;
      }
      if (!plan) continue;
      if (part.toolName === "create_checkout") {
        // A checkout that started ends the choice; one sent back for the card keeps it.
        if (typeof value.requestId === "string") plan.requestId = value.requestId;
        else if (!("error" in value)) plan = undefined;
      } else if (part.toolName === "request_agent_card" && typeof value.requestId === "string") {
        plan.requestId = value.requestId;
      } else if (part.toolName === "await_agent_card_approval") {
        if (value.status === "active" && typeof value.agentCardId === "string") {
          plan.approved = value.agentCardId;
        } else {
          plan.refused = true;
        }
      }
    }
  }
  return plan && hostOf(plan.url) === hostOf(startUrl) ? plan : undefined;
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

    // Client-side tool: no `execute`. The chat shows Crossmint's card form;
    // the model hears only which card was saved, never its number.
    await_saved_card: tool({
      description: describeTool("await_saved_card"),
      inputSchema: z.object({}),
      outputSchema: savedCardOutcomeSchema,
    }),

    // Client-side tool: no `execute`. The chat shows the question with
    // Crossmint's protected fields; the app answers the run with what they
    // return, and the model only hears whether the user did.
    await_protected_input: tool({
      description: describeTool("await_protected_input"),
      inputSchema: z.object({
        checkoutId: z.string().min(1).describe(paramDoc("await_protected_input", "checkoutId")),
        requestId: z.string().min(1).describe(paramDoc("await_protected_input", "requestId")),
      }),
      outputSchema: protectedInputOutcomeSchema,
    }),

    // Client-side tool: no `execute`. The chat opens the details form in a
    // sheet, where the browser can fill it in; the model hears only whether
    // the user saved it, and reads the details in the next turn's prompt.
    await_buyer_details: tool({
      description: describeTool("await_buyer_details"),
      inputSchema: z.object({}),
      outputSchema: buyerDetailsOutcomeSchema,
    }),

    // Client-side tool: no `execute`. The chat shows the product and the ways
    // to pay; the budget comes from the price, worked out in one place.
    await_payment_choice: tool({
      description: describeTool("await_payment_choice"),
      inputSchema: z.object({
        url: z.string().url().describe(paramDoc("await_payment_choice", "url")),
        item: z.string().min(1).max(80).describe(paramDoc("await_payment_choice", "item")),
        store: z
          .string()
          .min(1)
          .max(60)
          .optional()
          .describe(paramDoc("await_payment_choice", "store")),
        price: z
          .object({
            amount: z
              .string()
              .regex(/^\d+(\.\d{1,2})?$/)
              .describe('Decimal string, e.g. "35.99".'),
            currency: z.string().length(3).describe(PARAM_DOCS.currency),
          })
          .optional()
          .describe(paramDoc("await_payment_choice", "price")),
        category: z
          .string()
          .min(1)
          .max(60)
          .optional()
          .describe(paramDoc("await_payment_choice", "category")),
      }),
      outputSchema: paymentChoiceOutcomeSchema,
    }),

    // Client-side tool: no `execute`. The chat shows what the budget covers
    // and a few amounts; the user picks, then approves the card it makes.
    await_budget: tool({
      description: describeTool("await_budget"),
      inputSchema: z.object({
        category: z.string().min(1).max(60).describe(paramDoc("await_budget", "category")),
        amount: amountSchema.optional().describe(paramDoc("await_budget", "amount")),
        purchase: z.string().min(1).max(80).optional().describe(paramDoc("await_budget", "purchase")),
      }),
      outputSchema: budgetOutcomeSchema,
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
        "In this chat, every purchase pays from an agent card chosen before it starts. After await_payment_choice, the card they chose is used by itself. Any other purchase settles how to pay with await_budget first: pass its agentCardId, or payWithoutCard when the user chose another way or no budget. Called with neither, it comes back with budget_required. Pass cartOnly for a run that only changes a cart. Every checkout is told to buy once, not on a subscription, and to bill the shipping address; say so in the task only to ask for a subscription. Then call watch_checkout with the checkoutId, with no text in between.",
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
        // Chat only, and never sent to the API.
        cartOnly: z
          .boolean()
          .optional()
          .describe(
            "True when the run only changes the user's cart at a store (add, remove, save for later, empty) and does not buy. It skips the buyer details and the payment choice, and tells the store's agent not to check out.",
          ),
        agentCardId: z
          .string()
          .min(1)
          .optional()
          .describe(paramDoc("create_checkout", "agentCardId")),
        // Chat only, and never sent to the API.
        payWithoutCard: z
          .boolean()
          .optional()
          .describe(
            "True only when the user said to pay another way than an agent card for this purchase (PayPal, the card saved in their account at the store). The checkout then starts with no budget, and the store's own payment step is used.",
          ),
        maxCost: z
          .object({
            amount: z
              .string()
              .regex(/^\d+(\.\d{1,2})?$/)
              .describe('Decimal string, e.g. "50.00".'),
            currency: z.string().length(3).describe(PARAM_DOCS.currency),
          })
          .optional()
          .describe(
            "Only when the user gave a spending limit, or to try again above a total that stopped a run: the most to pay, including shipping and tax. Enforced. Otherwise leave it out: a run paid from a budget costs at most what the budget has left, and any other run at most the app's default.",
          ),
        currency: z
          .string()
          .length(3)
          .optional()
          .describe("The store's currency, when there is no maxCost. Default USD."),
        buyerProfileId: z
          .string()
          .min(1)
          .optional()
          .describe(paramDoc("create_checkout", "buyerProfileId")),
        purpose: z.string().min(1).max(80).describe(paramDoc("create_checkout", "purpose")),
      }),
      execute: async (
        { action, cartOnly, payWithoutCard, currency, maxCost, ...input },
        { messages },
      ) => {
        void action; // for the site card only
        if (cartOnly) {
          // Nothing is paid, so no agent card goes with it.
          const task = [input.task, CART_TERMS].filter(Boolean).join(" ");
          return guard(() =>
            api.createCheckout({
              ...input,
              agentCardId: undefined,
              ...(maxCost ? { maxCost } : {}),
              ...(currency ? { currency: currency.toUpperCase() } : {}),
              task,
            }),
          );
        }
        // A purchase with no saved details starts with the form, so the store
        // does not ask for them one by one. A user who skipped the form in
        // this chat goes on without, and the store asks what it needs.
        const saved = await api.getBuyerProfile().catch(() => undefined);
        if (saved === null && !skippedDetailsInChat(messages)) {
          return {
            error:
              "No buyer details are saved yet. Call await_buyer_details first, with no text in between, then call create_checkout again.",
            code: "buyer_details_required",
          };
        }
        // How to pay was settled in the chat, for this store: the checkout
        // starts with that agent card, and its payment step asks nothing.
        // Card with no card yet makes the request here, for the budget, and
        // sends the agent to show it; once approved, the checkout starts.
        let agentCardId = input.agentCardId;
        const plan = agentCardId ? undefined : cardPlanFor(messages, input.startUrl);
        if (plan?.choice.method === "agent_card" && plan.choice.agentCardId) {
          agentCardId = plan.choice.agentCardId;
        } else if (plan?.choice.method === "card" && plan.approved) {
          agentCardId = plan.approved;
        } else if (
          plan?.choice.method === "card" &&
          plan.choice.budget &&
          !plan.choice.approval &&
          !plan.refused
        ) {
          const request = plan.requestId
            ? await api.getAgentCardRequest(plan.requestId).catch(() => undefined)
            : undefined;
          const open =
            request && (request.status === "pending" || request.status === "approved")
              ? request
              : await guard(() =>
                  api.createAgentCardRequest({
                    amount: plan.choice.budget,
                    description: input.purpose,
                    expiresInHours: 2,
                    requester: CHAT_REQUESTER,
                  }),
                );
          if ("error" in open) return open;
          return {
            error: `The user chose to pay by card: a new agent card for up to ${open.amount.value} ${open.amount.currency} waits for their approval.`,
            code: "agent_card_approval_required",
            requestId: open.id,
            approvalUrl: open.approvalUrl,
            status: open.status,
            amount: open.amount,
            description: open.description,
            expiresAt: open.expiresAt,
            next: "Call await_agent_card_approval with this requestId now, with no text in between. Once it comes back active, call create_checkout again with the same input. If they deny it, ask in one line whether to pay another way.",
          };
        }
        // Any other purchase pays from a budget, settled before the checkout
        // starts: one the user has, or a new one. Or they chose another way,
        // and the store's payment step asks.
        if (!agentCardId && !plan && !payWithoutCard) {
          const settled = budgetPlanFor(messages);
          if (settled?.agentCardId) agentCardId = settled.agentCardId;
          else if (!settled) {
            return {
              error: "How to pay is not settled yet.",
              code: "budget_required",
              next: "Call await_budget now, with no text in between, with purchase (what this is, in a few words) and the broad kind of purchase as its category (Eating out, Travel, Tickets, Shopping). Then call create_checkout again with the same input: with its agentCardId when it returns active, else with payWithoutCard.",
            };
          }
        }
        // The store's agent asks for an email on most checkouts. Give it the
        // user's up front, so nobody is asked for what the app already knows.
        // It is a contact address: an account named in the task is the one to
        // sign in with, and must not be swapped for it.
        const email =
          opts.userEmail && !input.task?.includes(opts.userEmail)
            ? `The buyer's contact email is ${opts.userEmail}. It is not a store login: to sign in, use the account the task names, if any.`
            : undefined;
        const task = [input.task, PURCHASE_TERMS, email].filter(Boolean).join(" ");
        // The server sets the ceiling: what the budget has left, the user's
        // own limit when lower, or its default. A store that shows no total
        // before its card form asks for exactly that much.
        return guard(() =>
          api.createCheckout({
            ...input,
            ...(agentCardId ? { agentCardId } : {}),
            ...(maxCost ? { maxCost } : {}),
            ...(currency ? { currency: currency.toUpperCase() } : {}),
            task,
          }),
        );
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

    // Chat only: the receipt for a checkout that went through. The model says
    // what it was; the total, the reference and the card come from the run.
    show_receipt: tool({
      description: describeTool(
        "show_receipt",
        "The chat draws it as a receipt card under your message; do not repeat it in text.",
      ),
      inputSchema: z.object({
        checkoutId: z.string().min(1).describe(paramDoc("show_receipt", "checkoutId")),
        kind: z.enum(RECEIPT_KINDS).describe(paramDoc("show_receipt", "kind")),
        merchant: z.string().min(1).max(60).describe(paramDoc("show_receipt", "merchant")),
        title: z.string().max(60).optional().describe(paramDoc("show_receipt", "title")),
        details: z
          .array(z.object({ label: z.string().min(1).max(20), value: z.string().min(1).max(60) }))
          .max(6)
          .optional()
          .describe(paramDoc("show_receipt", "details")),
        items: z
          .array(
            z.object({
              label: z.string().min(1).max(60),
              amount: z
                .string()
                .regex(/^\d+(\.\d{1,2})?$/)
                .optional()
                .describe(paramDoc("show_receipt", "itemAmount")),
            }),
          )
          .max(10)
          .optional()
          .describe(paramDoc("show_receipt", "items")),
        currency: z.string().length(3).optional().describe(paramDoc("show_receipt", "currency")),
        reference: z.string().max(40).optional().describe(paramDoc("show_receipt", "reference")),
        // Chat only: the line above the receipt, so it always shows first.
        message: z
          .string()
          .min(1)
          .max(300)
          .optional()
          .describe(
            "What to say to the user, shown right above the receipt: one or two sentences on how it went. When you pass it, write no other text.",
          ),
      }),
      execute: ({ checkoutId, message, currency, reference, ...shown }) =>
        guard(async (): Promise<ShownReceipt | { error: string; code: string }> => {
          void message; // for the chat only
          const view = await api.getCheckout(checkoutId);
          if (view.status !== "succeeded") {
            return {
              error: `The checkout has not succeeded (it is ${view.status}). Say how it went in words instead.`,
              code: "checkout_not_succeeded",
            };
          }
          // The card that paid, for its artwork and label, and what it was
          // made for: the exact total the payment step asked for.
          const card = view.agentCardId
            ? await api.getAgentCard(view.agentCardId).catch(() => undefined)
            : undefined;
          const method = card
            ? (await api.listPaymentMethods().catch(() => [])).find(
                (m) => m.paymentMethodId === card.paymentMethodId,
              )
            : undefined;
          const total =
            view.receipt?.total ??
            (card ? { amount: card.amount.total, currency: card.amount.currency } : undefined);
          const host = hostOf(view.startUrl);
          const ref = view.receipt?.merchantOrderId ?? reference;
          return {
            ...shown,
            ...(host ? { host } : {}),
            ...(ref ? { reference: ref } : {}),
            ...(total ? { total } : {}),
            currency: (total?.currency ?? currency ?? "USD").toUpperCase(),
            ...(method ? { paymentMethod: method } : {}),
          };
        }),
    }),

    save_buyer_profile: tool({
      description: describeTool("save_buyer_profile"),
      // Every field optional: a save adds to what is saved, it does not start over.
      inputSchema: z.object({
        firstName: z
          .string()
          .min(1)
          .optional()
          .describe(paramDoc("save_buyer_profile", "firstName")),
        lastName: z.string().min(1).optional().describe(paramDoc("save_buyer_profile", "lastName")),
        email: z.string().email().optional().describe(paramDoc("save_buyer_profile", "email")),
        phone: z.string().min(3).optional().describe(paramDoc("save_buyer_profile", "phone")),
        addressLines: z
          .array(z.string().min(1))
          .min(1)
          .optional()
          .describe(paramDoc("save_buyer_profile", "addressLines")),
        city: z.string().min(1).optional().describe(paramDoc("save_buyer_profile", "city")),
        region: z.string().min(2).optional().describe(paramDoc("save_buyer_profile", "region")),
        postalCode: z
          .string()
          .min(1)
          .optional()
          .describe(paramDoc("save_buyer_profile", "postalCode")),
        countryCode: z
          .string()
          .length(2)
          .optional()
          .describe(paramDoc("save_buyer_profile", "countryCode")),
        label: z
          .string()
          .min(1)
          .max(60)
          .optional()
          .describe(paramDoc("save_buyer_profile", "label")),
      }),
      execute: (input) =>
        guard(async () => {
          const saved = await api.getBuyerProfile();
          const merged = mergeBuyerProfile(saved, input, opts.userEmail);
          if ("missing" in merged) {
            return {
              error: `Nothing saved yet: still missing ${merged.missing.join(", ")}. Ask the user for ${merged.missing.length > 1 ? "them" : "it"}, then save again with only what they give you.`,
              code: "invalid_request",
            };
          }
          const profile = normalizeBuyerProfile(merged.profile);
          const problems = buyerProfileProblems(profile, { requirePhone: true });
          if (problems.length) {
            return {
              error: `Nothing saved: ${problems.map((p) => p.message).join(" ")} Tell the user what to fix, then save again with only what they correct.`,
              code: "invalid_request",
            };
          }
          const created = await api.createBuyerProfile(profile);
          return {
            buyerProfileId: created.id,
            saved: true,
            kept: saved
              ? "Every field you did not pass was kept from the saved details."
              : undefined,
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
        // Plain answers only: a protected field is answered in the app, never by the model.
        values: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
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
