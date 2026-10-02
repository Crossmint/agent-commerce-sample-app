/**
 * The prompt that builds this app's flows into someone else's agent app. A
 * developer pastes it into a coding agent (Claude Code, Cursor, Codex) in
 * their own repository. The same text is in the README, under "Build it into
 * your agent app": change both together.
 */
export const BUILD_PROMPT = `Add agentic commerce to my app with the Crossmint Agents APIs. My users save a card
once. When my agent needs to pay, it asks for a budget, the user approves it inside my
app, and the agent buys on any website.

Use these sources:
- Crossmint docs index: https://docs.crossmint.com/llms.txt
  (or add the docs MCP server: https://docs.crossmint.com/mcp)
- Agent cards: https://docs.crossmint.com/agents/cards-quickstart
- Agent Checkouts: https://docs.crossmint.com/agents/agent-checkouts-quickstart
- A working reference app: https://github.com/Crossmint/agent-commerce-sample-app
  (its HTTP API contract is in docs/API.md)

First, read my codebase. Tell me my framework, my auth provider, and where my agent
runs: an in-app chat, a messaging bot, an MCP server or a CLI. Then propose a plan
and wait for my OK before you write code.

Build these parts:
1. Save a card with the CrossmintPaymentMethodManagement component from
   @crossmint/client-sdk-react-ui. The card goes to Crossmint, never to my servers.
2. Agent cards. When the agent needs money, create an order intent with an amount,
   a merchant and an expiry. Show an approval screen in my app where the user picks
   a card and approves. Run OrderIntentVerification when the card rail needs it.
3. Agent Checkouts. Start a run at a product URL with a max cost and stream its
   messages. Answer each form request with all its fields in one answer. Pay its
   payment step with an agent card for the exact amount. Collect each protected
   field, such as a store password, with CrossmintProtectedInput.
4. Buyer details. Save the user's name, contact and shipping address as a buyer
   profile, so checkouts do not stop to ask for them.
5. Agent tools. Give my agent tools to list saved cards, request an agent card,
   start a checkout and answer it. Show each approval as a component in my UI, or
   as a link when the agent has no UI.

Rules:
- The model never sees a full card number, a CVC or a password.
- Nothing is paid until the user approves the budget.
- The Crossmint server key stays on my server. Card and order-intent calls use the
  client key with the signed-in user's JWT.
- Agent Checkouts need a production server key with the agent-checkouts scopes,
  and the x-crossmint-user-id header on every call.`;
