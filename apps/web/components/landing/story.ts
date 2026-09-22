import { AGENT_COMPANY, AGENT_DOMAIN, AGENT_NAME } from "@/components/brand";

/*
 * The one story every mock on the page tells: the user asks Acme Agent for a
 * pair of running socks, the agent asks for a $35 budget, the user approves
 * once, the agent checks out at the store and sends the receipt. One place
 * for the figures, so the phone, the terminal and the desktop window agree.
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

  ask: "Buy the running socks I saved on Nike",
  purpose: "Running socks",
  amount: "$35.00",
  amountBare: "35",
  expires: "Sep 29, 2026",
  card: "Visa •••• 4242",
  merchant: "Nike",
  domain: "nike.com",
  productUrl: "https://www.nike.com/t/everyday-plus-cushioned-socks",
  order: "NK-88213",
  agentCardId: "ac_01J9X4M2",
  requestId: "req_8f2k1d",

  /** The example URLs, all on Acme's domain. */
  approveUrl: `${agentOrigin}/approve/req_8f2k1d`,
  approvePath: `${AGENT_DOMAIN}/approve/req_8f2k1d`,
  appAddress: `${AGENT_DOMAIN}/app`,
  mcpUrl: `${agentOrigin}/api/mcp`,

  receipt: {
    lines: [
      { label: "Everyday Plus Cushioned, 3-pack", amount: "$28.00" },
      { label: "Shipping", amount: "$0.00" },
      { label: "Tax", amount: "$2.48" },
    ],
    total: "$30.48",
  },
  /** The checkout steps Crossmint's browser runs through, in order. */
  checkoutSteps: [
    "Opened nike.com",
    "Added to cart",
    "Filled shipping",
    "Paid with the agent card",
    "Order placed",
  ],
} as const;
