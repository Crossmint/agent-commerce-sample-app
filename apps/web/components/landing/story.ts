import { AGENT_COMPANY, AGENT_DOMAIN, AGENT_NAME } from "@/components/brand";

/*
 * The one story every mock on the page tells: the user asks Acme Agent for
 * their usual coffee, the agent asks for a $10 budget, the user approves
 * once, the agent orders at Starbucks and sends the receipt. One place for
 * the figures, so the phone, the terminal and the desktop window agree.
 *
 * The agent is Acme's, not Crossmint's: every agent surface and every
 * example URL wears Acme. Crossmint stays in the page chrome.
 */

const agentOrigin = `https://${AGENT_DOMAIN}`;

export const STORY = {
  /** The agent the user talks to, and the company that built it. */
  agent: AGENT_NAME,
  company: AGENT_COMPANY,
  agentDomain: AGENT_DOMAIN,
  agentOrigin,
  /** Acme's own CLI, built on @agent-commerce/cli. */
  cli: AGENT_COMPANY.toLowerCase(),

  ask: "Order my usual coffee from Starbucks",
  purpose: "Coffee",
  amount: "$10.00",
  amountBare: "10",
  expires: "Sep 29, 2026",
  card: "Mastercard •••• 4444",
  merchant: "Starbucks",
  domain: "starbucks.com",
  productUrl: "https://www.starbucks.com/menu/product/latte",
  order: "SB-88213",
  agentCardId: "ac_01J9X4M2",
  requestId: "req_8f2k1d",

  /** The example URLs, all on Acme's domain. */
  approveUrl: `${agentOrigin}/approve/req_8f2k1d`,
  approvePath: `${AGENT_DOMAIN}/approve/req_8f2k1d`,
  appAddress: `${AGENT_DOMAIN}/app`,
  mcpUrl: `${agentOrigin}/api/mcp`,

  receipt: {
    lines: [
      { label: "Caffè Latte, Grande", amount: "$5.45" },
      { label: "Oat milk", amount: "$0.80" },
      { label: "Tax", amount: "$0.55" },
    ],
    total: "$6.80",
  },
  /** The checkout steps Crossmint's browser runs through, in order. */
  checkoutSteps: [
    "Opened starbucks.com",
    "Added the latte",
    "Chose store pickup",
    "Paid with the agent card",
    "Order placed",
  ],
} as const;
