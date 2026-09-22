import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  describeTool,
  formatAmount,
  PARAM_DOCS,
  paramDoc,
  renderPendingAction,
  TOOL_DOCS,
  toDecimalString,
  toolNamesFor,
} from "@agent-commerce/core";
import type { RenderedAction, RenderedField, ToolNameFor } from "@agent-commerce/core";
import { AgentCommerceApiError } from "./api.js";
import type {
  AgentCard,
  AgentCardRequest,
  CheckoutView,
  CredentialResult,
  AgentCommerceApi,
} from "./api.js";
import * as z from "zod";

export interface AgentCommerceToolsContext {
  api: AgentCommerceApi;
  /** Label shown to the user on the approval screen, e.g. "Claude". Default "Agent". */
  requester?: string;
}

/**
 * The tools this server offers. Names, summaries and parameter docs come
 * from `TOOL_DOCS` in core, shared with the chat agent; this file adds the
 * MCP-specific sentence to each description (links to show, fields returned)
 * and the zod shapes.
 */
export type AgentCommerceToolName = ToolNameFor<"mcp">;
export const AGENT_COMMERCE_TOOL_NAMES: readonly AgentCommerceToolName[] = toolNamesFor("mcp");

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const amountSchema = z.union([z.number(), z.string()]).describe(PARAM_DOCS.amountMajor);

const currencySchema = z.string().length(3).describe(PARAM_DOCS.currency);

const merchantSchema = z
  .object({
    name: z.string().describe(PARAM_DOCS.merchantName),
    url: z.string().describe(PARAM_DOCS.merchantUrl),
    countryCode: z.string().length(2).describe(PARAM_DOCS.merchantCountryCode),
  })
  .describe(PARAM_DOCS.merchant);

const title = (name: AgentCommerceToolName) => TOOL_DOCS[name].title;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerAgentCommerceTools(
  server: McpServer,
  ctx: AgentCommerceToolsContext,
): void {
  const { api } = ctx;

  server.registerTool(
    "list_payment_methods",
    {
      title: title("list_payment_methods"),
      description: describeTool("list_payment_methods"),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async () => {
      const paymentMethods = await api.listPaymentMethods();
      const lines = paymentMethods.length
        ? paymentMethods.map((pm) => {
            const card = pm.card ? `${pm.card.brand} •••• ${pm.card.last4}` : pm.type;
            const exp = pm.card?.expiration
              ? `, exp ${pm.card.expiration.month}/${pm.card.expiration.year}`
              : "";
            return `- ${pm.displayName ?? card} (${pm.paymentMethodId})${exp}${pm.default ? ", default" : ""}`;
          })
        : ["No saved cards. The user adds one in the wallet website."];
      return ok(lines.join("\n"), { paymentMethods });
    }),
  );

  server.registerTool(
    "request_agent_card",
    {
      title: title("request_agent_card"),
      description: describeTool(
        "request_agent_card",
        "Returns an approval URL. Show the URL to the user, then poll get_agent_card_request until status is active.",
      ),
      inputSchema: {
        amount: amountSchema.describe(paramDoc("request_agent_card", "amount")),
        currency: currencySchema.optional(),
        description: z.string().min(1).describe(paramDoc("request_agent_card", "description")),
        merchant: merchantSchema.optional().describe(paramDoc("request_agent_card", "merchant")),
        expiresInHours: z
          .number()
          .positive()
          .optional()
          .describe(paramDoc("request_agent_card", "expiresInHours")),
        requester: z
          .string()
          .optional()
          .describe(
            `${paramDoc("request_agent_card", "requester")} Defaults to the server's label.`,
          ),
      },
    },
    guard(async (args) => {
      const req = await api.createAgentCardRequest({
        amount: {
          value: toDecimalString(args.amount),
          currency: (args.currency ?? "USD").toUpperCase(),
        },
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
      title: title("get_agent_card_request"),
      description: describeTool("get_agent_card_request"),
      inputSchema: {
        requestId: z.string().describe(paramDoc("get_agent_card_request", "requestId")),
      },
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
      title: title("list_agent_cards"),
      description: describeTool("list_agent_cards"),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async () => {
      const agentCards = await api.listAgentCards();
      const text = agentCards.length
        ? agentCards.map(describeAgentCard).join("\n")
        : "No agent cards.";
      return ok(text, { agentCards });
    }),
  );

  server.registerTool(
    "get_agent_card",
    {
      title: title("get_agent_card"),
      description: describeTool("get_agent_card"),
      inputSchema: { agentCardId: z.string().describe(paramDoc("get_agent_card", "agentCardId")) },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ agentCardId }) => {
      const agentCard = await api.getAgentCard(agentCardId);
      return ok(describeAgentCard(agentCard), { agentCard });
    }),
  );

  server.registerTool(
    "reveal_agent_card",
    {
      title: title("reveal_agent_card"),
      description: describeTool(
        "reveal_agent_card",
        "Returns the card number, expiry and CVC. Use them only in the merchant's checkout form. Never repeat them to the user.",
      ),
      inputSchema: {
        agentCardId: z.string().describe(paramDoc("reveal_agent_card", "agentCardId")),
        amount: amountSchema.optional().describe(paramDoc("reveal_agent_card", "amount")),
        currency: currencySchema.optional().describe(paramDoc("reveal_agent_card", "currency")),
        merchant: merchantSchema.optional().describe(paramDoc("reveal_agent_card", "merchant")),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    guard(async (args) => {
      let amount: { value: string; currency: string } | undefined;
      if (args.amount !== undefined) {
        const currency =
          args.currency ?? (await api.getAgentCard(args.agentCardId)).amount.currency;
        amount = { value: toDecimalString(args.amount), currency: currency.toUpperCase() };
      }
      const cred = await api.mintCredential(args.agentCardId, {
        amount,
        merchant: args.merchant,
        format: "card",
      });
      return ok(describeCredential(cred, amount), {
        ...cred,
        warning: cred.enforced ? undefined : enforcedWarning(cred, amount),
      });
    }),
  );

  server.registerTool(
    "revoke_agent_card",
    {
      title: title("revoke_agent_card"),
      description: describeTool("revoke_agent_card"),
      inputSchema: {
        agentCardId: z.string().describe(paramDoc("revoke_agent_card", "agentCardId")),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    guard(async ({ agentCardId }) => {
      await api.revokeAgentCard(agentCardId);
      return ok(`Agent card ${agentCardId} revoked.`, { agentCardId, revoked: true });
    }),
  );

  server.registerTool(
    "create_checkout",
    {
      title: title("create_checkout"),
      description: describeTool(
        "create_checkout",
        "Here the payment step arrives as a link on get_checkout: show it to the user and let them choose a payment method in the browser.",
      ),
      inputSchema: {
        startUrl: z.string().url().describe(paramDoc("create_checkout", "startUrl")),
        task: z.string().max(20000).optional().describe(paramDoc("create_checkout", "task")),
        agentCardId: z.string().optional().describe(paramDoc("create_checkout", "agentCardId")),
        maxCost: amountSchema.describe(paramDoc("create_checkout", "maxCost")),
        currency: currencySchema.optional(),
        buyerProfileId: z
          .string()
          .optional()
          .describe(paramDoc("create_checkout", "buyerProfileId")),
        browserProfileId: z
          .string()
          .optional()
          .describe(paramDoc("create_checkout", "browserProfileId")),
        merchantGuidance: z
          .string()
          .max(20000)
          .optional()
          .describe(paramDoc("create_checkout", "merchantGuidance")),
      },
      annotations: { openWorldHint: true },
    },
    guard(async (args) => {
      const checkout = await api.createCheckout({
        startUrl: args.startUrl,
        task: args.task,
        agentCardId: args.agentCardId,
        maxCost: {
          amount: toDecimalString(args.maxCost),
          currency: (args.currency ?? "USD").toUpperCase(),
        },
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
      title: title("get_checkout"),
      description: describeTool(
        "get_checkout",
        "Here paymentRequest carries an approvalUrl: show it to the user, then keep polling until they have chosen.",
      ),
      inputSchema: { checkoutId: z.string().describe(paramDoc("get_checkout", "checkoutId")) },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    guard(async ({ checkoutId }) => {
      const checkout = await api.getCheckout(checkoutId);
      const rendered = renderedAction(checkout);
      return ok(describeCheckout(checkout), {
        checkout: rendered ? { ...checkout, rendered } : checkout,
      });
    }),
  );

  server.registerTool(
    "answer_checkout",
    {
      title: title("answer_checkout"),
      description: describeTool("answer_checkout"),
      inputSchema: {
        checkoutId: z.string().describe(paramDoc("answer_checkout", "checkoutId")),
        requestId: z.string().optional().describe(paramDoc("answer_checkout", "requestId")),
        action: z
          .enum(["submit", "decline", "alternative"])
          .optional()
          .describe(paramDoc("answer_checkout", "action")),
        values: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(paramDoc("answer_checkout", "values")),
        text: z.string().max(20000).optional().describe(paramDoc("answer_checkout", "text")),
      },
      annotations: { openWorldHint: true },
    },
    guard(async ({ checkoutId, ...input }) => {
      const checkout = await api.answerCheckout(checkoutId, input);
      return ok(describeCheckout(checkout), { checkout });
    }),
  );

  server.registerTool(
    "cancel_checkout",
    {
      title: title("cancel_checkout"),
      description: describeTool("cancel_checkout"),
      inputSchema: { checkoutId: z.string().describe(paramDoc("cancel_checkout", "checkoutId")) },
      annotations: { openWorldHint: true },
    },
    guard(async ({ checkoutId }) => {
      const checkout = await api.cancelCheckout(checkoutId);
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
  if (err instanceof AgentCommerceApiError) {
    const hint =
      err.code === "unauthorized"
        ? " The user must connect (log in) again."
        : err.code === "no_usable_rail"
          ? " The agent card has no active rail. The user may still need to verify it in the wallet."
          : "";
    return {
      isError: true,
      content: [{ type: "text", text: `Agent Commerce error ${err.code}: ${err.message}.${hint}` }],
      structuredContent: {
        error: { code: err.code, message: err.message, status: err.status, details: err.details },
      },
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }],
    structuredContent: { error: { message } },
  };
}

/** Wrap a tool body so API failures become `isError` results instead of protocol errors. */
function guard<A extends unknown[]>(
  fn: (...args: A) => Promise<CallToolResult>,
): (...args: A) => Promise<CallToolResult> {
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
  const rails = card.rails
    .map((r) => `${r.rail}${"provider" in r && r.provider ? `/${r.provider}` : ""}:${r.status}`)
    .join(", ");
  const merchant = card.merchant ? ` Merchant: ${card.merchant.name}.` : "";
  return (
    `- ${card.orderIntentId}: "${card.description}", ${card.status}. ` +
    `Available ${formatAmount(card.amount.available, card.amount.currency)} of ${formatAmount(card.amount.total, card.amount.currency)} ` +
    `(spent ${formatAmount(card.amount.spent, card.amount.currency)}). Expires ${card.expiresAt}.${merchant} Rails: ${rails || "none"}.`
  );
}

function enforcedWarning(
  cred: CredentialResult,
  amount?: { value: string; currency: string },
): string {
  const limit = amount ? formatAmount(amount.value, amount.currency) : "the agent card limit";
  return (
    `WARNING: the ${cred.rail} rail does not enforce the limit. Crossmint will not block a charge above ${limit}. ` +
    `Keep the charge within the limit yourself, or prefer create_checkout, whose maxCost is enforced.`
  );
}

function describeCredential(
  cred: CredentialResult,
  amount?: { value: string; currency: string },
): string {
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
  lines.push(
    "Use these fields only in the merchant's checkout form. Do not show or repeat them to the user.",
  );
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
  const opts = f.options
    ? ` one of: ${f.options.map((o) => JSON.stringify(o.value)).join(", ")}`
    : "";
  const desc = f.description ? ` — ${f.description}` : "";
  const line = `${indent}- ${f.name} (${f.kind}${f.required ? ", required" : ""})${opts}${desc}`;
  const children = f.children?.map((c) => describeField(c, indent + "  ")) ?? [];
  return [line, ...children].join("\n");
}

function describeCheckout(checkout: CheckoutView): string {
  const lines = [`Checkout ${checkout.id}: status ${checkout.status}.`];
  const action = renderedAction(checkout);
  if (action) {
    lines.push(
      `Question (requestId "${action.id}"): ${action.title}${action.description ? ` — ${action.description}` : ""}`,
    );
    if (action.fields.length) {
      lines.push("Fields:", ...action.fields.map((f) => describeField(f)));
    }
    if (action.expiresAt) lines.push(`Answer before ${action.expiresAt}, or the checkout fails.`);
    lines.push(
      `Ask the user if you do not know a value. Then call answer_checkout with checkoutId "${checkout.id}" and requestId "${action.id}" ` +
        `(values to submit, or action "decline" / "alternative").`,
    );
  }
  if (checkout.paymentRequest) {
    const pr = checkout.paymentRequest;
    lines.push(
      `Payment step: the run needs a payment method before it can pay. Show the user this link so they can choose one, which mints an agent card for up to ${pr.amount.value} ${pr.amount.currency}: ${pr.approvalUrl}`,
      `Then keep polling get_checkout. Do not answer this with answer_checkout, and never send card fields. Request status: ${pr.status}.`,
    );
  }
  if (checkout.embedUrl)
    lines.push(`The user can watch the agent's browser at: ${checkout.embedUrl}`);
  if (checkout.receipt) {
    lines.push(
      `Receipt: total ${checkout.receipt.total.amount} ${checkout.receipt.total.currency}${checkout.receipt.merchantOrderId ? `, order ${checkout.receipt.merchantOrderId}` : ""}.`,
    );
  } else if (checkout.status === "succeeded") {
    lines.push("Succeeded. The order went through but no receipt could be read.");
  }
  if (checkout.result?.summary) lines.push(`Summary: ${checkout.result.summary}`);
  if (checkout.failure) {
    const label =
      checkout.status === "blocked"
        ? "Blocked"
        : checkout.status === "cancelled"
          ? "Cancelled"
          : "Failed";
    lines.push(
      `${label}: ${checkout.failure.reason}${checkout.failure.message ? ` — ${checkout.failure.message}` : ""}.`,
    );
  }
  if (checkout.spentUsd) lines.push(`Spent so far: ${checkout.spentUsd} USD.`);
  if (!action && !checkout.failure && checkout.status !== "succeeded") {
    lines.push("Still running. Poll get_checkout again in a few seconds.");
  }
  return lines.join("\n");
}
