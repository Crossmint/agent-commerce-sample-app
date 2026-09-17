import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatAmount, renderPendingAction, toDecimalString } from "@goat-wallet/core";
import type { RenderedAction, RenderedField } from "@goat-wallet/core";
import { GoatApiError } from "./goat-api.js";
import type { AgentCard, AgentCardRequest, CheckoutView, CredentialResult, GoatApi } from "./goat-api.js";
import * as z from "zod";

export interface GoatToolsContext {
  api: GoatApi;
  /** Label shown to the user on the approval screen, e.g. "Claude". Default "Agent". */
  requester?: string;
}

export const GOAT_TOOL_NAMES = [
  "list_payment_methods",
  "request_agent_card",
  "get_agent_card_request",
  "list_agent_cards",
  "get_agent_card",
  "reveal_agent_card",
  "revoke_agent_card",
  "create_checkout",
  "get_checkout",
  "answer_checkout",
  "cancel_checkout",
] as const;

export type GoatToolName = (typeof GOAT_TOOL_NAMES)[number];

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const amountSchema = z
  .union([z.number(), z.string()])
  .describe('Decimal amount in major units, e.g. 50 or "50.00".');

const currencySchema = z
  .string()
  .length(3)
  .describe("ISO 4217 currency code. Default USD.");

const merchantSchema = z
  .object({
    name: z.string().describe("Merchant name, e.g. United Airlines."),
    url: z.string().describe("Merchant website URL."),
    countryCode: z.string().length(2).describe("ISO 3166-1 alpha-2 country code, e.g. US."),
  })
  .describe("Restrict spending to one merchant.");

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerGoatTools(server: McpServer, ctx: GoatToolsContext): void {
  const { api } = ctx;

  server.registerTool(
    "list_payment_methods",
    {
      title: "List saved cards",
      description: "List the user's saved cards (masked: brand and last 4). These are the cards an agent card can draw from.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async () => {
      const paymentMethods = await api.listPaymentMethods();
      const lines = paymentMethods.length
        ? paymentMethods.map((pm) => {
            const card = pm.card ? `${pm.card.brand} •••• ${pm.card.last4}` : pm.type;
            const exp = pm.card?.expiration ? `, exp ${pm.card.expiration.month}/${pm.card.expiration.year}` : "";
            return `- ${pm.displayName ?? card} (${pm.paymentMethodId})${exp}${pm.default ? ", default" : ""}`;
          })
        : ["No saved cards. The user adds one in the wallet website."];
      return ok(lines.join("\n"), { paymentMethods });
    }),
  );

  server.registerTool(
    "request_agent_card",
    {
      title: "Request an agent card",
      description:
        "Ask the user to approve a spending limit on one of their cards. Returns an approval URL. " +
        "Show the URL to the user, then poll get_agent_card_request until status is active.",
      inputSchema: {
        amount: amountSchema,
        currency: currencySchema.optional(),
        description: z.string().min(1).describe("What the money is for, in the user's words, e.g. Flight to SF."),
        merchant: merchantSchema.optional(),
        expiresInHours: z.number().positive().optional().describe("How long the agent card stays valid. Default set by the server (24h)."),
        requester: z.string().optional().describe("Name of the agent shown to the user. Defaults to the server's label."),
      },
    },
    guard(async (args) => {
      const req = await api.createAgentCardRequest({
        amount: { value: toDecimalString(args.amount), currency: (args.currency ?? "USD").toUpperCase() },
        description: args.description,
        merchant: args.merchant,
        expiresInHours: args.expiresInHours,
        requester: args.requester ?? ctx.requester,
      });
      const text = [
        `Approval needed. Show this link to the user and ask them to approve: ${req.approvalUrl}`,
        `Request ${req.id} for ${formatAmount(req.amount.value, req.amount.currency)}: ${req.description}.`,
        `The user has until ${req.requestExpiresAt} to answer.`,
        `Then call get_agent_card_request with requestId "${req.id}" every few seconds until status is "active". ` +
          `Stop on "denied", "expired" or "failed". Once active, use agentCardId with reveal_agent_card or create_checkout.`,
      ].join("\n");
      return ok(text, {
        requestId: req.id,
        approvalUrl: req.approvalUrl,
        status: req.status,
        amount: req.amount,
        description: req.description,
        expiresAt: req.expiresAt,
        requestExpiresAt: req.requestExpiresAt,
      });
    }),
  );

  server.registerTool(
    "get_agent_card_request",
    {
      title: "Check an agent card request",
      description: "Poll an agent card request. Status goes pending → approved → active, or denied / expired / failed.",
      inputSchema: { requestId: z.string().describe("The requestId from request_agent_card.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ requestId }) => {
      const req = await api.getAgentCardRequest(requestId);
      return ok(describeRequest(req), { request: req });
    }),
  );

  server.registerTool(
    "list_agent_cards",
    {
      title: "List agent cards",
      description: "List the user's agent cards with status, available balance and expiry.",
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async () => {
      const agentCards = await api.listAgentCards();
      const text = agentCards.length ? agentCards.map(describeAgentCard).join("\n") : "No agent cards.";
      return ok(text, { agentCards });
    }),
  );

  server.registerTool(
    "get_agent_card",
    {
      title: "Get an agent card",
      description: "Get one agent card: status, balance, expiry, rails.",
      inputSchema: { id: z.string().describe("Agent card id.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ id }) => {
      const agentCard = await api.getAgentCard(id);
      return ok(describeAgentCard(agentCard), { agentCard });
    }),
  );

  server.registerTool(
    "reveal_agent_card",
    {
      title: "Reveal card details",
      description:
        "Mint a scoped card number from an active agent card. Use it only to pay in a merchant's checkout form. " +
        "Prefer create_checkout when the target is a website. Never repeat the card fields to the user.",
      inputSchema: {
        id: z.string().describe("Agent card id."),
        amount: amountSchema.optional().describe("Amount for this payment. Default: the agent card's available balance."),
        currency: currencySchema.optional().describe("Currency for amount. Default: the agent card's currency."),
        merchant: merchantSchema
          .optional()
          .describe(
            "The store you are about to pay: name, url, countryCode. Required when the agent card has no merchant lock. Card networks issue a number per merchant.",
          ),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    guard(async (args) => {
      let amount: { value: string; currency: string } | undefined;
      if (args.amount !== undefined) {
        const currency = args.currency ?? (await api.getAgentCard(args.id)).amount.currency;
        amount = { value: toDecimalString(args.amount), currency: currency.toUpperCase() };
      }
      const cred = await api.mintCredential(args.id, { amount, merchant: args.merchant, format: "card" });
      return ok(describeCredential(cred, amount), { ...cred, warning: cred.enforced ? undefined : enforcedWarning(cred, amount) });
    }),
  );

  server.registerTool(
    "revoke_agent_card",
    {
      title: "Revoke an agent card",
      description: "Revoke an agent card. Existing card numbers stop working. Cannot be undone.",
      inputSchema: { id: z.string().describe("Agent card id.") },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(async ({ id }) => {
      await api.revokeAgentCard(id);
      return ok(`Agent card ${id} revoked.`, { id, revoked: true });
    }),
  );

  server.registerTool(
    "create_checkout",
    {
      title: "Create a checkout",
      description:
        "Buy at a product URL with an active agent card. Crossmint drives the store's checkout in a real browser and pays with the card; " +
        "the card number never reaches you. maxCost is a hard cap: the run stops as blocked instead of paying more. " +
        "Returns the checkout id. Poll get_checkout every few seconds until it is done or asks a question.",
      inputSchema: {
        startUrl: z.string().url().describe("Product or cart page URL to start from."),
        task: z
          .string()
          .max(20000)
          .optional()
          .describe("What to buy and how, e.g. medium, black, cheapest shipping, pay by card. The more you say here, the fewer questions the agent stops to ask."),
        agentCardId: z.string().describe("An active agent card id. It pays."),
        maxCost: amountSchema.describe("Maximum total to pay, including shipping and tax. Enforced."),
        currency: currencySchema.optional(),
        buyerProfileId: z.string().optional().describe("Saved buyer profile (name, contact, shipping)."),
        browserProfileId: z.string().optional().describe("Saved merchant logins, for stores where the user is signed in."),
        merchantGuidance: z.string().max(20000).optional().describe("Notes about this store for the agent."),
      },
      annotations: { openWorldHint: true },
    },
    guard(async (args) => {
      const checkout = await api.createCheckout({
        startUrl: args.startUrl,
        task: args.task,
        agentCardId: args.agentCardId,
        maxCost: { amount: toDecimalString(args.maxCost), currency: (args.currency ?? "USD").toUpperCase() },
        buyerProfileId: args.buyerProfileId,
        browserProfileId: args.browserProfileId,
        merchantGuidance: args.merchantGuidance,
      });
      return ok(`Checkout ${checkout.id} created.\n${describeCheckout(checkout)}`, { checkout });
    }),
  );

  server.registerTool(
    "get_checkout",
    {
      title: "Get a checkout",
      description:
        "Get a checkout's status: queued, running, awaiting_input, succeeded, blocked, failed or cancelled. " +
        "When it is awaiting_input the result lists the question and its fields; answer with answer_checkout. " +
        "Payment questions never appear: the server answers them from the agent card.",
      inputSchema: { id: z.string().describe("Checkout id.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ id }) => {
      const checkout = await api.getCheckout(id);
      const rendered = renderedAction(checkout);
      return ok(describeCheckout(checkout), { checkout: rendered ? { ...checkout, rendered } : checkout });
    }),
  );

  server.registerTool(
    "answer_checkout",
    {
      title: "Answer a checkout question",
      description:
        "Answer the open question on a checkout. Pass requestId with values keyed by field name (as listed by get_checkout) to submit, " +
        "action decline to refuse it, or action alternative with text to suggest another way (e.g. use the cheapest shipping). " +
        "Without requestId, text is a note to the agent mid-run. Never send card fields.",
      inputSchema: {
        id: z.string().describe("Checkout id."),
        requestId: z.string().optional().describe("The pending request id from get_checkout."),
        action: z.enum(["submit", "decline", "alternative"]).optional().describe("Default submit."),
        values: z.record(z.string(), z.unknown()).optional().describe("Field values keyed by field name, for submit."),
        text: z.string().max(20000).optional().describe("Free text: the alternative, or a note for the agent."),
      },
      annotations: { openWorldHint: true },
    },
    guard(async ({ id, ...input }) => {
      const checkout = await api.answerCheckout(id, input);
      return ok(describeCheckout(checkout), { checkout });
    }),
  );

  server.registerTool(
    "cancel_checkout",
    {
      title: "Cancel a checkout",
      description: "Stop a running checkout. It reaches cancelled on a later get_checkout.",
      inputSchema: { id: z.string().describe("Checkout id.") },
      annotations: { openWorldHint: true },
    },
    guard(async ({ id }) => {
      const checkout = await api.cancelCheckout(id);
      return ok(describeCheckout(checkout), { checkout });
    }),
  );
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function ok(text: string, structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text }], structuredContent };
}

function fail(err: unknown): CallToolResult {
  if (err instanceof GoatApiError) {
    const hint =
      err.code === "unauthorized"
        ? " The user must connect (log in) again."
        : err.code === "no_usable_rail"
          ? " The agent card has no active rail. The user may still need to verify it in the wallet."
          : "";
    return {
      isError: true,
      content: [{ type: "text", text: `GOAT error ${err.code}: ${err.message}.${hint}` }],
      structuredContent: { error: { code: err.code, message: err.message, status: err.status, details: err.details } },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text", text: `Error: ${message}` }], structuredContent: { error: { message } } };
}

/** Wrap a tool body so API failures become `isError` results instead of protocol errors. */
function guard<A extends unknown[]>(fn: (...args: A) => Promise<CallToolResult>): (...args: A) => Promise<CallToolResult> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      return fail(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Text summaries
// ---------------------------------------------------------------------------

function describeRequest(req: AgentCardRequest): string {
  const head = `Request ${req.id}: status ${req.status}. ${formatAmount(req.amount.value, req.amount.currency)} for "${req.description}".`;
  switch (req.status) {
    case "pending":
      return `${head}\nWaiting for the user. Approval link: ${req.approvalUrl}\nPoll again in a few seconds.`;
    case "approved":
      return `${head}\nThe user approved. The card is being verified. Poll again in a few seconds.`;
    case "active":
      return `${head}\nActive. Agent card id: ${req.agentCardId}. Valid until ${req.expiresAt}. Use it with reveal_agent_card or create_checkout.`;
    case "denied":
      return `${head}\nThe user denied the request. Do not retry without asking the user.`;
    case "expired":
      return `${head}\nThe request expired before the user answered. Ask the user, then request again.`;
    case "failed":
      return `${head}\nFailed${req.failureReason ? `: ${req.failureReason}` : ""}.`;
    default:
      return head;
  }
}

function describeAgentCard(card: AgentCard): string {
  const rails = card.rails.map((r) => `${r.rail}${"provider" in r && r.provider ? `/${r.provider}` : ""}:${r.status}`).join(", ");
  const merchant = card.merchant ? ` Merchant: ${card.merchant.name}.` : "";
  return (
    `- ${card.orderIntentId}: "${card.description}", ${card.status}. ` +
    `Available ${formatAmount(card.amount.available, card.amount.currency)} of ${formatAmount(card.amount.total, card.amount.currency)} ` +
    `(spent ${formatAmount(card.amount.spent, card.amount.currency)}). Expires ${card.expiresAt}.${merchant} Rails: ${rails || "none"}.`
  );
}

function enforcedWarning(cred: CredentialResult, amount?: { value: string; currency: string }): string {
  const limit = amount ? formatAmount(amount.value, amount.currency) : "the agent card limit";
  return (
    `WARNING: the ${cred.rail} rail does not enforce the limit. Crossmint will not block a charge above ${limit}. ` +
    `Keep the charge within the limit yourself, or prefer create_checkout, whose maxCost is enforced.`
  );
}

function describeCredential(cred: CredentialResult, amount?: { value: string; currency: string }): string {
  const lines = [
    `Credential for agent card ${cred.agentCardId} on rail ${cred.rail}${cred.provider ? ` (${cred.provider})` : ""}. ` +
      (cred.enforced ? "The limit is enforced by the network." : enforcedWarning(cred, amount)),
  ];
  if (cred.card) {
    lines.push(
      `Card number: ${cred.card.number}`,
      `Expiration: ${cred.card.expirationMonth}/${cred.card.expirationYear}`,
      `CVC: ${cred.card.cvc}`,
    );
  }
  if (cred.token) lines.push(`Token: ${cred.token}`);
  if (cred.expiresAt) lines.push(`Credential expires ${cred.expiresAt}.`);
  lines.push("Use these fields only in the merchant's checkout form. Do not show or repeat them to the user.");
  return lines.join("\n");
}

function renderedAction(checkout: CheckoutView): RenderedAction | undefined {
  if (checkout.rendered) return checkout.rendered;
  if (checkout.pendingUserAction) {
    try {
      return renderPendingAction(checkout.pendingUserAction);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function describeField(f: RenderedField, indent = "  "): string {
  const opts = f.options ? ` one of: ${f.options.map((o) => JSON.stringify(o.value)).join(", ")}` : "";
  const desc = f.description ? ` — ${f.description}` : "";
  const line = `${indent}- ${f.name} (${f.kind}${f.required ? ", required" : ""})${opts}${desc}`;
  const children = f.children?.map((c) => describeField(c, indent + "  ")) ?? [];
  return [line, ...children].join("\n");
}

function describeCheckout(checkout: CheckoutView): string {
  const lines = [`Checkout ${checkout.id}: status ${checkout.status}.`];
  const action = renderedAction(checkout);
  if (action) {
    lines.push(`Question (requestId "${action.id}"): ${action.title}${action.description ? ` — ${action.description}` : ""}`);
    if (action.fields.length) {
      lines.push("Fields:", ...action.fields.map((f) => describeField(f)));
    }
    if (action.expiresAt) lines.push(`Answer before ${action.expiresAt}, or the checkout fails.`);
    lines.push(
      `Ask the user if you do not know a value. Then call answer_checkout with id "${checkout.id}" and requestId "${action.id}" ` +
        `(values to submit, or action "decline" / "alternative").`,
    );
  }
  if (checkout.embedUrl) lines.push(`The user can watch the agent's browser at: ${checkout.embedUrl}`);
  if (checkout.receipt) {
    lines.push(`Receipt: total ${checkout.receipt.total.amount} ${checkout.receipt.total.currency}${checkout.receipt.merchantOrderId ? `, order ${checkout.receipt.merchantOrderId}` : ""}.`);
  } else if (checkout.status === "succeeded") {
    lines.push("Succeeded. The order went through but no receipt could be read.");
  }
  if (checkout.result?.summary) lines.push(`Summary: ${checkout.result.summary}`);
  if (checkout.failure) {
    const label = checkout.status === "blocked" ? "Blocked" : checkout.status === "cancelled" ? "Cancelled" : "Failed";
    lines.push(`${label}: ${checkout.failure.reason}${checkout.failure.message ? ` — ${checkout.failure.message}` : ""}.`);
  }
  if (checkout.spentUsd) lines.push(`Spent so far: ${checkout.spentUsd} USD.`);
  if (!action && !checkout.failure && checkout.status !== "succeeded") {
    lines.push("Still running. Poll get_checkout again in a few seconds.");
  }
  return lines.join("\n");
}
