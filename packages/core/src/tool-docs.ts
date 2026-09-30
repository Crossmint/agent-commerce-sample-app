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
      "List the user's saved payment methods, masked: brand, last four digits, expiry. Never a full number. A payment method is what an agent card is minted from, and what the user picks at a checkout's payment step.",
    params: {},
    surfaces: ["mcp", "chat"],
  },
  request_agent_card: {
    title: "Request an agent card",
    summary:
      "Ask the user to approve an agent card: scoped, user-approved spending minted from one of their saved payment methods. Returns a requestId and the request status. Nothing is spent until the user approves. " +
      "You do not need one to buy something. Prefer create_checkout and let the payment step mint the card. Request one up front only when the agent needs a card number of its own, for instance to drive a store in your own browser.",
    params: {
      amount: "Spending limit.",
      currency: PARAM_DOCS.currency,
      description:
        "What the money is for, in the user's words, e.g. Flight to SF. Shown on the approval screen.",
      merchant:
        "Lock the card to one merchant, only when the user named a real store (Starbucks, united.com). Leave it out for a general budget such as lunch this week or a trip: the purpose is not a store.",
      expiresInHours: "How long the agent card stays valid. Default 24.",
      requester: "Name of the agent shown to the user.",
    },
    surfaces: ["mcp", "chat"],
  },
  get_agent_card_request: {
    title: "Check an agent card request",
    summary:
      "Poll an agent card request. Status goes pending → approved → active, or denied / expired / failed. Once active, the result carries the agentCardId.",
    params: {
      requestId:
        "The requestId from request_agent_card, or the one on a checkout's paymentRequest.",
    },
    surfaces: ["mcp"],
  },
  await_agent_card_approval: {
    title: "Wait for approval in the chat",
    summary:
      "Wait for the user to choose a payment method and approve an agent card, right here in the chat. Call it after request_agent_card, or at a checkout's payment step when the user wants a new agent card, with the requestId from watch_checkout's payment. The result carries the agentCardId when approved.",
    params: {
      requestId: "The requestId from request_agent_card, or from a checkout's payment step.",
    },
    surfaces: ["chat"],
  },
  list_agent_cards: {
    title: "List agent cards",
    summary:
      "List the user's agent cards (approved spending permissions) with status, total, available balance and expiry. Worth a look when you mean to reuse one; a checkout does not need it, because its payment step mints its own.",
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
      "Mint a scoped card credential from an active agent card, for paying somewhere Agent Checkouts does not reach: your own browser automation, or a form you drive yourself. Prefer create_checkout when the target is a website: its maxCost is enforced and it runs its own payment step. Check enforced: false means the limit is advisory on that rail.",
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
    summary:
      "Revoke an agent card. Existing card numbers stop working. Cannot be undone. Ask the user first.",
    params: { agentCardId: PARAM_DOCS.agentCardId },
    surfaces: ["mcp", "chat"],
  },
  create_checkout: {
    title: "Create a checkout",
    summary:
      "Buy at a product URL with Agent Checkouts. Crossmint drives the store's checkout in a real browser and pays; the card number never reaches you. " +
      "Start here when the user asks to buy something. Do not request an agent card first: the run reaches a payment step of its own, where the user chooses a payment method and an agent card is minted for this purchase. " +
      "maxCost is a hard cap: the run stops as blocked instead of paying more. Returns the checkoutId. Poll get_checkout every few seconds until it is done or asks a question.",
    params: {
      startUrl: "Product or cart page URL to start from.",
      purpose:
        "What the purchase is, in a few words, as the user would say it: Blue Pikachu erasable pen, Dinner for 2 at Nopa, 2 tickets to Coldplay. The user sees it when they approve the payment. Under 40 characters, no instructions.",
      task: "What to buy and how, e.g. medium, black, cheapest shipping, pay by card. The more you say here, the fewer questions the agent stops to ask.",
      agentCardId:
        "Optional. An agent card the user already approved, to pay from it without asking again. Leave it out and the user chooses a payment method when the run reaches its payment step.",
      maxCost:
        "Maximum total to pay, including shipping and tax. Enforced. Optional: with an agentCardId it is what the card has left, and otherwise the server's default. A store that shows no total before its card form asks for exactly this much.",
      currency: PARAM_DOCS.currency,
      buyerProfileId:
        "Rarely needed. The user's saved buyer details (name, contact, shipping) are attached for you, so the store does not ask for them. Pass this only to name a different profile.",
      browserProfileId:
        "Rarely needed. The user's saved merchant logins are attached for you, so a store they signed into once stays signed in. Pass this only to name a different profile.",
      freshBrowser:
        "Start signed out, ignoring the user's saved merchant logins. Use it when a stale login is what is blocking the run, not by default.",
      merchantGuidance: "Notes about this store for the agent.",
    },
    surfaces: ["mcp", "chat"],
  },
  get_checkout: {
    title: "Get a checkout",
    summary:
      "Get a checkout's status: queued, running, awaiting_input, succeeded, blocked, failed or cancelled. When it is awaiting_input the result carries the question and its fields; answer with answer_checkout. " +
      "When the run reaches its payment step the result carries paymentRequest instead: the user chooses a payment method, that mints an agent card scoped to this purchase, and Agent Commerce answers the store from it. Wait for it, then keep polling; never answer a payment question yourself and never send card fields. " +
      "Finished runs carry the receipt, or the blocked code or failure reason.",
    params: { checkoutId: PARAM_DOCS.checkoutId },
    surfaces: ["mcp", "chat"],
  },
  watch_checkout: {
    title: "Watch a checkout",
    summary:
      "Follow a running checkout for the user. While it runs, the chat shows the user each update the store's agent writes, as its own message; you do not repeat them. " +
      "Call it straight after create_checkout, and again after each answer you send; never poll get_checkout meanwhile. It returns with the updates it showed and one of four reasons. " +
      "awaiting_input with a question: the store asks something, and you put it to the user. awaiting_payment with a payment: the run reached its payment step, and the user chooses how to pay. " +
      "awaiting_password with a password: the store asks for the password of the user's account there; call await_protected_input, and never ask for the password in words. " +
      "A final status (succeeded, blocked, failed, cancelled): the run ended, with the total and the order number, or why it stopped.",
    params: { checkoutId: PARAM_DOCS.checkoutId },
    surfaces: ["chat"],
  },
  await_saved_card: {
    title: "Wait for a card",
    summary:
      "Show the user a secure form to add a card, and wait until they have. The card is saved with Crossmint: neither you nor the chat sees the number. " +
      "Call it when the user wants to add a card, or needs one and has none saved, with no text in between; the chat asks the user. It returns saved, with the card's network and last four digits, or cancelled.",
    params: {},
    surfaces: ["chat"],
  },
  await_buyer_details: {
    title: "Wait for the buyer's details",
    summary:
      "Ask the user for their name, email, phone number and shipping address, and wait. The chat shows a card with Add details, which opens a form the browser can fill in, and Not now. Every later checkout starts with these details, so stores do not ask. " +
      "Call it before a purchase when no details are saved, with no text in between; for a Shopify product, right after await_payment_choice. The chat asks the user. It returns saved, or skipped when the user would rather not.",
    params: {},
    surfaces: ["chat"],
  },
  await_payment_choice: {
    title: "Ask how to pay",
    summary:
      "Ask the user how to pay for a product on a Shopify store: by card, with Shop Pay, or another way (PayPal, Klarna or one they type). Card has them take an agent card they already have that fits the store, or approve a new one for the budget, before it returns: then it returns agent_card with the agentCardId to start the checkout with. Wait for the answer. " +
      "Call it only when the user pressed Buy on a product card from search_products or look_up_products, before anything else, with no text in between; the chat shows the product and the choices. Never for a link the user pasted or typed, even on a Shopify store: start the checkout for those. " +
      "It returns the method, the agentCardId of a card they already have, the name of another way when the user typed one, and a budget: the price with room for shipping and tax, when the price is known.",
    params: {
      url: "The product page URL, as search_products or look_up_products gave it.",
      item: "The product, in a few words, e.g. IQBAR Chocolate Mint Chip bars.",
      store: "The store's name, e.g. IQBAR.",
      price: "The price the product card shows, as an amount and a currency.",
      category:
        "What a new budget would cover, when the user picks Card: the broad kind of purchase this is, in one to three words, so the same budget pays for similar purchases later. E.g. Clothing for socks, Snacks for protein bars, Home goods for a lamp. Never the item or the store.",
    },
    surfaces: ["chat"],
  },
  await_budget: {
    title: "Ask for a budget",
    summary:
      "Ask the user to set up a budget: an agent card for a kind of purchase, such as Groceries or Clothing, that the agent pays similar purchases from until it runs out or ends. The chat asks in its own words, shows what the budget covers (the user can change it), how long it lasts (1, 7 or 30 days) and a few amounts ($20, $50, $100, or one they type), then has them approve it. Nothing is spent until they approve. It is never locked to one store. " +
      "With purchase, it settles how to pay for that purchase before its checkout starts: it also offers the general budgets the user already has, and Use a different payment method. " +
      "Call it with no text in between. It returns active with the agentCardId, what it covers and the amount (existing when they picked a budget they had); other when they want to pay another way; denied, expired or failed when it was not approved; or cancelled when the user said Not now.",
    params: {
      category:
        "What the budget covers: a broad kind of purchase in one to three words, e.g. Groceries, Clothing, Eating out. What the user said, or your best guess from the chat. Never a store.",
      amount: "The amount the user named, if they named one: it is picked first.",
      purchase:
        "Only before a checkout: what is being bought, in a few words, e.g. Table for 2 at Nopa, Cubone keychain. Leave it out for a budget on its own.",
    },
    surfaces: ["chat"],
  },
  await_protected_input: {
    title: "Wait for a password",
    summary:
      "When a checkout asks for the password of the user's account at the store, show the user a secure field for it and wait. The password goes straight to Crossmint's vault: neither you nor the chat ever sees it, and the app answers the checkout itself. " +
      "Call it straight after watch_checkout returns awaiting_password, with no text in between; the chat asks the user. It returns submitted, then call watch_checkout again, or declined, when the user would rather not sign in: ask whether to check out as a guest (answer_checkout with action alternative) or stop.",
    params: {
      checkoutId: PARAM_DOCS.checkoutId,
      requestId: "The password request's requestId, from watch_checkout's password.",
    },
    surfaces: ["chat"],
  },
  search_products: {
    title: "Search products",
    summary:
      "Search products across every Shopify store, for when the user wants something but has no link. Returns a few in-stock products, each with its picture, price, store, rating, options and the product page URL to pass to create_checkout.",
    params: {
      query: "What to look for, in plain words, e.g. sour gummy candy or a black wool beanie.",
      maxPrice: "Most the user wants to pay per item, in major units, when they said so.",
      shipsTo: "Two-letter country the item must ship to. Default US.",
    },
    surfaces: ["chat"],
  },
  look_up_products: {
    title: "Show products",
    summary:
      "Look products up by their page URLs on Shopify stores, and show them to the user with their pictures, prices and stores. Use it to put a product you are about to suggest in front of the user. Never use it on a link the user sent to buy: start the checkout for that link instead. Returns the same shape as search_products; URLs it cannot find are left out.",
    params: {
      urls: "Product page URLs, 1 to 5.",
    },
    surfaces: ["chat"],
  },
  show_receipt: {
    title: "Send the receipt",
    summary:
      "Send the user the receipt for a checkout that succeeded. Call it once, right after the checkout ends as succeeded. " +
      "The total, the order number and the card that paid are filled in from the checkout; you say what it was, from what the store reported.",
    params: {
      checkoutId: "The checkout that succeeded.",
      kind: "purchase for things shipped, food for a meal or a coffee to pick up or have delivered, reservation for a table or a stay, tickets for events and experiences, travel for flights and trains, other for anything else.",
      merchant: "Who it is from, as the user knows them: IQBAR, Nopa, Sala Apolo, Iberia.",
      title:
        "What it is, in a few words, when the items do not say it: Dinner for 2, 2 tickets to Coldplay. Leave it out for a purchase whose items say it.",
      details:
        "The facts the user needs, short, in order: Date, Time, Party, Seats, Venue, Route, Delivery, Pickup. Only what the store confirmed.",
      items:
        "What was bought, with quantities in the label (2 × Caffè Latte), then shipping and tax, when the store showed them. Leave it out when it would only repeat the title.",
      itemAmount: 'Decimal string, e.g. "12.99". Only when the store showed it.',
      currency: "The currency of the item amounts, when the checkout states no total.",
      reference: "The order or confirmation number the store gave, when the checkout reports none.",
    },
    surfaces: ["chat"],
  },
  save_buyer_profile: {
    title: "Save the buyer's details",
    summary:
      "Save the user's name, email, phone number and shipping address as their buyer profile. Every later checkout starts with it, so the store fills those fields itself instead of asking. " +
      "Pass only what the user gave you or changed: it is added to what is saved, and every field you leave out is kept. When nothing is saved yet, the first save needs the full name, a phone number and the full address; it says what is still missing. " +
      "When the address changes, pass every part of the new one.",
    params: {
      firstName: "First name.",
      lastName: "Last name.",
      email: "Email address. Default: the signed-in user's.",
      phone:
        "Phone number, for the delivery. Stores ask for one on most checkouts, so ask the user for it if they have not said.",
      addressLines: "Street address, one line per entry.",
      city: "City or town.",
      region: "State or province as ISO 3166-2, e.g. US-CA, when the country has them.",
      postalCode: "Postal or ZIP code.",
      countryCode: "ISO 3166-1 alpha-2 country code, e.g. US.",
      label: "What the address is, in the user's words, e.g. Home. Default Home.",
    },
    surfaces: ["chat"],
  },
  pay_checkout_with_agent_card: {
    title: "Pay a checkout with an agent card",
    summary:
      "At a checkout's payment step, pay from an agent card the user already has, when they chose one, instead of making a new one. The card must be active, have money left, and not be locked to another store. Agent Commerce answers the store's card form from it; you never see the number.",
    params: {
      checkoutId: PARAM_DOCS.checkoutId,
      agentCardId: "The agent card the user chose, from list_agent_cards.",
    },
    surfaces: ["chat"],
  },
  answer_checkout: {
    title: "Answer a checkout question",
    summary:
      "Answer the open question on a checkout. Pass requestId with values keyed by field name (as listed by get_checkout) to submit, action decline to refuse it, or action alternative with text to suggest another way (e.g. use the cheapest shipping). " +
      "Without requestId, text is a note to the agent mid-run. Never send card fields: the payment step is answered from the agent card the user picks. " +
      "Never send a password, and never ask the user for one: a request for the password of their account at the store (pendingUserAction.protected) is answered by the user in a secure field, on the checkout's page in the app. You may decline it, or send an alternative such as checking out as a guest.",
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
  return AGENT_COMMERCE_TOOL_NAMES.filter((name) =>
    (TOOL_DOCS[name].surfaces as readonly ToolSurface[]).includes(surface),
  ) as ToolNameFor<S>[];
}

/** The shared summary, plus one surface-specific sentence when given. */
export function describeTool(name: AgentCommerceToolName, addendum?: string): string {
  const summary = TOOL_DOCS[name].summary;
  return addendum ? `${summary} ${addendum}` : summary;
}

/** A parameter's shared description. Typed to the tool's own parameter names. */
export function paramDoc<N extends AgentCommerceToolName>(
  name: N,
  param: keyof (typeof TOOL_DOCS)[N]["params"] & string,
): string {
  return (TOOL_DOCS[name].params as Record<string, string>)[param] ?? param;
}
