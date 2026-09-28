<div align="center">

# Agent Commerce Sample App

### Let AI agents buy with your users' own cards.<br>Your users approve every budget.

An open source sample app by [Crossmint](https://www.crossmint.com). Fork it, add your brand, and ship agentic commerce in your own product.

**[Try it live](https://agent-commerce.demos-crossmint.com)** &nbsp;·&nbsp; [Read the docs](https://docs.crossmint.com/agents/overview) &nbsp;·&nbsp; [Talk to sales](https://www.crossmint.com/contact/sales)

<br>

<img src=".github/assets/promo.gif" alt="A user saves a card. An agent asks for a $10 budget at Starbucks. The user approves with a passkey, and the agent buys a latte on starbucks.com." width="100%">

</div>

<br>

## Three APIs. One approval screen that you host.

<table>
  <tr>
    <td width="33%" align="center"><img src=".github/assets/approve-a-budget.gif" alt="The agent asks for a $10 Starbucks budget. The user adds a card and approves it." width="260"></td>
    <td width="33%" align="center"><img src=".github/assets/buy-anything.gif" alt="The agent orders a latte on starbucks.com, gets the budget approved at the payment step, and shows the receipt." width="260"></td>
    <td width="33%" align="center"><img src=".github/assets/sign-in-to-stores.gif" alt="Amazon asks the agent to sign in. The user types the password once, and the agent places the order." width="260"></td>
  </tr>
  <tr>
    <td valign="top">
      <b>Save cards. Approve budgets.</b><br>
      The card goes straight into Crossmint's PCI vault. It never touches your servers. The agent asks for an amount, a store and an expiry. The user approves once.
    </td>
    <td valign="top">
      <b>Buy on any website.</b><br>
      One call to Crossmint Agent Checkouts buys a product, books a table or a flight, or gets event tickets. It works with UCP and with any browser checkout.
    </td>
    <td valign="top">
      <b>Sign in to stores.</b><br>
      When a store asks for a login, the user types it once. It is encrypted, only that store uses it, and the agent never sees it.
    </td>
  </tr>
</table>

Visa Intelligent Commerce and Mastercard Agent Pay enforce each limit on the card network. Your users keep their points and rewards.

## Works where your agents are

The same APIs run every experience:

- **Your own app.** Add components to save cards, approve budgets and show receipts in your chat.
- **Messaging apps.** On iMessage, WhatsApp or Instagram, the agent sends a link. The user approves on a page that you host.
- **MCP hosts.** Add one URL to Claude, ChatGPT or Cursor. OAuth signs the user in the first time.
- **Terminal agents.** A CLI and a skill for Claude Code, Codex and other coding agents.

Try it in Claude Code:

```
/plugin marketplace add Crossmint/agent-commerce-sample-app
/plugin install agent-commerce@agent-commerce
```

## Why not Stripe Link?

- **It stays your product.** Your users, your brand, and no second login on a different platform.
- **Your users' own cards.** Agent cards come from the cards your users already have, so they keep their rewards.
- **No middleman.** Bank statements show the merchant. Refunds and chargebacks go straight to the merchant.

## Run it yourself

You need:

- A [Crossmint](https://www.crossmint.com/console) project. Agent Checkouts need a production server key.
- A [Stytch](https://stytch.com) project for user login.
- Optional: a Postgres URL. Without one, the app keeps its data in memory.
- Optional: an Anthropic or OpenAI API key for the agent chat.

```bash
git clone https://github.com/Crossmint/agent-commerce-sample-app.git
cd agent-commerce-sample-app
pnpm install
pnpm turbo run build --filter='./packages/*'
cp .env.example apps/web/.env.local
pnpm dev
```

Fill in your keys in `apps/web/.env.local`, then open http://localhost:3000. The comments in `.env.example` explain each variable. To deploy, import the repository in Vercel and set the root directory to `apps/web`.

## What is inside

| Path | What it is |
|---|---|
| [`apps/web`](apps/web) | The Next.js site: the landing page, the app at `/app`, the HTTP API and the MCP endpoint. |
| [`packages`](packages) | The code behind the site: the Crossmint client, auth, API handlers, React components, the MCP server and the CLI. They are workspace packages, not published to npm. |
| [`skills/agent-commerce`](skills/agent-commerce) | A skill that teaches coding agents to use the CLI. |
| [`plugins`](plugins) | Claude Code and Cursor plugins with the hosted MCP server and the skill. |
| [`docs/API.md`](docs/API.md) | The HTTP API contract. |

## License

[MIT](LICENSE)
