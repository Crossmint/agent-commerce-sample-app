/*
 * One source for what each Agent Commerce tool does. The MCP server and the chat agent
 * both build their tool descriptions from here: the shared facts live in
 * `summary` and `params`, and each surface appends one short addendum about
 * how the result reaches the user (a link to approve, an inline component,
 * card fields shown or masked).
 *
 * When you change a tool, also touch:
 * - packages/mcp/src/tools.ts and apps/web/lib/chat/tools.ts (the addenda and the zod shapes)
 * - apps/web/lib/chat/prompt.ts (the flow the chat model follows)
 * - packages/cli/src/commands/* help text, and skills/agent-commerce/SKILL.md (then `pnpm plugin:sync`)
 * - docs/ARCHITECTURE.md section 3.5
 */

export type ToolSurface = "mcp" | "chat";

export interface ToolDoc {
  /** Short human title. */
  title: string;
  /** What the tool does and the rules that hold on every surface. */
  summary: string;
  /** Parameter name → description. Surfaces attach these to their own schemas. */
  params: Readonly<Record<string, string>>;
  /** Where the tool is offered. */
  surfaces: readonly ToolSurface[];
}

/** Descriptions shared by several tools' parameters. */
export const PARAM_DOCS = {
  amountMajor: 'Decimal amount in major units, e.g. 50 or "50.00".',
  currency: "ISO 4217 currency code. Default USD.",
  agentCardId: "Agent card id.",
  checkoutId: "Checkout id, as returned by create_checkout.",
  merchant: "The store: name, website url, and two-letter countryCode.",
  merchantName: "Merchant name, e.g. United Airlines.",
  merchantUrl: "Merchant website URL, e.g. https://united.com.",
  merchantCountryCode: "ISO 3166-1 alpha-2 country code, e.g. US.",
} as const;

export const TOOL_DOCS = {
  list_payment_methods: {
    title: "List saved cards",
    summary:
      "List the user's saved cards, masked: brand, last four digits, expiry. Never a full number. These are the cards an agent card can draw from.",
    params: {},
    surfaces: ["mcp", "chat"],
  },
  request_agent_card: {
    title: "Request an agent card",
    summary:
      "Ask the user to approve an agent card: a bounded budget on one of their saved cards. Returns a requestId and the request status. Nothing is spent until the user approves.",
    params: {
      amount: "Spending limit.",
      currency: PARAM_DOCS.currency,
      description: "What the money is for, in the user's words, e.g. Flight to SF. Shown on the approval screen.",
      merchant: "Lock the card to one merchant when the store is known.",
      expiresInHours: "How long the agent card stays valid. Default 24.",
      requester: "Name of the agent shown to the user.",
    },
    surfaces: ["mcp", "chat"],
  },
  get_agent_card_request: {
    title: "Check an agent card request",
    summary:
      "Poll an agent card request. Status goes pending → approved → active, or denied / expired / failed. Once active, the result carries the agentCardId.",
    params: { requestId: "The requestId from request_agent_card." },
    surfaces: ["mcp"],
  },
  await_agent_card_approval: {
    title: "Wait for approval in the chat",
    summary:
      "Wait for the user to approve or deny an agent card request in the chat. Call it right after request_agent_card. The result carries the agentCardId when approved.",
    params: { requestId: "The requestId from request_agent_card." },
    surfaces: ["chat"],
  },
  list_agent_cards: {
    title: "List agent cards",
    summary:
      "List the user's agent cards (approved budgets) with status, total, available balance and expiry. Check this before requesting a new one: reuse an active card that fits the purchase.",
    params: {},
    surfaces: ["mcp", "chat"],
  },
  get_agent_card: {
    title: "Get an agent card",
    summary: "Get one agent card: status, balance, expiry, rails, merchant lock.",
    params: { agentCardId: PARAM_DOCS.agentCardId },
    surfaces: ["mcp", "chat"],
  },
  reveal_agent_card: {
    title: "Reveal card details",
    summary:
      "Mint a scoped card credential from an active agent card. Prefer create_checkout when the target is a website: its maxCost is enforced. Check enforced: false means the limit is advisory on that rail.",
    params: {
      agentCardId: PARAM_DOCS.agentCardId,
      amount: "Amount for this payment. Default: the agent card's available balance.",
      currency: "Currency for amount. Default: the agent card's currency.",
      merchant:
        "The store you are about to pay: name, url, countryCode. Required when the agent card has no merchant lock. Card networks issue a number per merchant.",
    },
    surfaces: ["mcp", "chat"],
  },
  revoke_agent_card: {
    title: "Revoke an agent card",
    summary: "Revoke an agent card. Existing card numbers stop working. Cannot be undone. Ask the user first.",
    params: { agentCardId: PARAM_DOCS.agentCardId },
    surfaces: ["mcp", "chat"],
  },
  create_checkout: {
    title: "Create a checkout",
    summary:
      "Buy at a product URL with an active agent card. Crossmint drives the store's checkout in a real browser and pays with the card; the card number never reaches you. " +
      "maxCost is a hard cap: the run stops as blocked instead of paying more. Returns the checkoutId. Poll get_checkout every few seconds until it is done or asks a question.",
    params: {
      startUrl: "Product or cart page URL to start from.",
      task: "What to buy and how, e.g. medium, black, cheapest shipping, pay by card. The more you say here, the fewer questions the agent stops to ask.",
      agentCardId: "An active agent card id. It pays.",
      maxCost: "Maximum total to pay, including shipping and tax. Enforced.",
      currency: PARAM_DOCS.currency,
      buyerProfileId: "Saved buyer profile (name, contact, shipping).",
      browserProfileId: "Saved merchant logins, for stores where the user is signed in.",
      merchantGuidance: "Notes about this store for the agent.",
    },
    surfaces: ["mcp", "chat"],
  },
  get_checkout: {
    title: "Get a checkout",
    summary:
      "Get a checkout's status: queued, running, awaiting_input, succeeded, blocked, failed or cancelled. When it is awaiting_input the result carries the question and its fields; answer with answer_checkout. " +
      "Payment questions never appear: the server answers them from the agent card. Finished runs carry the receipt, or the blocked code or failure reason.",
    params: { checkoutId: PARAM_DOCS.checkoutId },
    surfaces: ["mcp", "chat"],
  },
  answer_checkout: {
    title: "Answer a checkout question",
    summary:
      "Answer the open question on a checkout. Pass requestId with values keyed by field name (as listed by get_checkout) to submit, action decline to refuse it, or action alternative with text to suggest another way (e.g. use the cheapest shipping). " +
      "Without requestId, text is a note to the agent mid-run. Never send card fields: the server pays.",
    params: {
      checkoutId: PARAM_DOCS.checkoutId,
      requestId: "The pending request id from get_checkout.",
      action: "submit (default), decline, or alternative.",
      values: "Field values keyed by field name, for submit.",
      text: "Free text: the alternative, or a note for the agent.",
    },
    surfaces: ["mcp", "chat"],
  },
  cancel_checkout: {
    title: "Cancel a checkout",
    summary: "Stop a running checkout. It reaches cancelled on a later get_checkout.",
    params: { checkoutId: PARAM_DOCS.checkoutId },
    surfaces: ["mcp", "chat"],
  },
} as const satisfies Record<string, ToolDoc>;

export type AgentCommerceToolName = keyof typeof TOOL_DOCS;

/** The tool names offered on one surface, as a type. */
export type ToolNameFor<S extends ToolSurface> = {
  [K in AgentCommerceToolName]: S extends (typeof TOOL_DOCS)[K]["surfaces"][number] ? K : never;
}[AgentCommerceToolName];

export const AGENT_COMMERCE_TOOL_NAMES = Object.keys(TOOL_DOCS) as AgentCommerceToolName[];

export function toolNamesFor<S extends ToolSurface>(surface: S): ToolNameFor<S>[] {
  return AGENT_COMMERCE_TOOL_NAMES.filter((name) => (TOOL_DOCS[name].surfaces as readonly ToolSurface[]).includes(surface)) as ToolNameFor<S>[];
}

/** The shared summary, plus one surface-specific sentence when given. */
export function describeTool(name: AgentCommerceToolName, addendum?: string): string {
  const summary = TOOL_DOCS[name].summary;
  return addendum ? `${summary} ${addendum}` : summary;
}

/** A parameter's shared description. Typed to the tool's own parameter names. */
export function paramDoc<N extends AgentCommerceToolName>(name: N, param: keyof (typeof TOOL_DOCS)[N]["params"] & string): string {
  return (TOOL_DOCS[name].params as Record<string, string>)[param] ?? param;
}
