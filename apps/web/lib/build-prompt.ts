/**
 * The prompt that builds this app's flows into someone else's agent app. A
 * developer pastes it into a coding agent (Claude Code, Cursor, Codex) in
 * their own repository. The same text is in the README, under "Build it into
 * your agent app": change both together.
 */
export const BUILD_PROMPT = `Add agentic commerce to my app with the Crossmint Agents APIs, so my users can buy on
any website with a budget they approve.

Use these sources:
- Crossmint docs index: https://docs.crossmint.com/llms.txt
- Agent cards: https://docs.crossmint.com/agents/cards-quickstart
- Agent Checkouts: https://docs.crossmint.com/agents/agent-checkouts-quickstart
- Signed-in stores: https://docs.crossmint.com/agents/checkouts/merchant-sessions
- A working reference app: https://github.com/Crossmint/agent-commerce-sample-app
  (its HTTP API contract is in docs/API.md)

First, read my codebase. Tell me my framework, my auth provider, and where my agent
runs: an in-app chat, a messaging bot, an MCP server, a CLI, or no agent at all.

Then ask me how the experience should work, with your suggested answer for each:
- Payment method: an agent card from a saved card, as in the reference app, or what
  the store offers at checkout, such as a saved card, Shop Pay, Klarna or PayPal.
- When my users add a payment method: at sign-up, in settings, or the first time
  a purchase needs one.
- When to create the order intent, the budget the user approves: before the
  purchase starts, or at the checkout's payment step for the exact total.
- How a purchase starts and checks out: the agent decides in a chat, the user taps
  a buy button, or a job runs on a schedule.
When I answer, propose a plan and wait for my OK before you write code.

Build these parts, in the shape I chose:
1. Payment method. Set up the one I chose. For a card, use the
   CrossmintPaymentMethodManagement component from @crossmint/client-sdk-react-ui.
   The card goes to Crossmint, never to my servers.
2. Agent cards, if I chose them. Create an order intent with an amount, a merchant
   and an expiry. The user picks a card and approves it in my UI, or at a link when
   there is no UI. Run OrderIntentVerification when the card rail needs it.
3. Agent Checkouts. Start a run at a product URL with a max cost and stream its
   messages. Answer each form request with all its fields in one answer. Pay its
   payment step with the method I chose.
4. Buyer details. Save the user's name, contact and shipping address as a buyer
   profile, so checkouts do not stop to ask for them.
5. Signed-in stores. Let users sign in to a store during a checkout. Collect each
   protected field, such as the password, with CrossmintProtectedInput. Keep one
   browser profile per user, so the store stays signed in on later checkouts.`;
