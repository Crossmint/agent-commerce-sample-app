# Agent Commerce Sample App

An open source sample app for agentic commerce on the Crossmint Agents APIs.

The Agent Commerce Sample App shows how to add card payments for AI agents to your platform. A user saves a card. An agent asks for a bounded budget on it, an "agent card". The user approves in a browser. The agent then pays with a scoped card number, or lets Crossmint Agent Checkouts buy on its behalf.

It is not a crypto wallet. It wraps the Crossmint Agents APIs and adds the parts Crossmint does not ship: the approval screen, the agent tooling, and the glue between them.

## What do I use?

| You have | You want | Install | Copy |
|---|---|---|---|
| A web app with users | Users save cards and grant your agent budgets | `@agent-commerce/core` `@agent-commerce/server` `@agent-commerce/ui` | the `/app` screens from `apps/web` |
| An agent in Claude Code, ChatGPT, or a chat channel | A hosted place where users approve, plus agent tooling | Deploy `apps/web`. Give agents `agent-commerce` or the MCP URL | Nothing. Configure and deploy |
| Your own auth (Auth0, Clerk, Supabase) | All of the above with your login | Implement `UserAuth` from `@agent-commerce/auth` | `packages/auth/src/stytch.ts` as a template |
| Your own backend | Only the typed Crossmint client | `@agent-commerce/core` | Nothing |
| A chat product | Approve cards inline in the conversation | `@agent-commerce/ui` + `@agent-commerce/server` in process | `components/chat` and `api/chat` from `apps/web` |

## Packages

| Package | What it is |
|---|---|
| [`@agent-commerce/core`](packages/core) | Typed Crossmint Agents client. Rail selection. Encrypted-card decryption. Checkout action rendering. |
| [`@agent-commerce/auth`](packages/auth) | One `UserAuth` interface. Stytch adapter. Generic JWKS adapter. OAuth PKCE helpers. |
| [`@agent-commerce/server`](packages/server) | The HTTP API as Web-standard request handlers. Mounts in one Next.js route file at `/api/agent-commerce`. |
| [`@agent-commerce/ui`](packages/ui) | React components on shadcn/ui: save card, approve, verify, list, checkout. |
| [`@agent-commerce/mcp`](packages/mcp) | MCP server exposing the API as tools, with OAuth 2.1. |
| [`@agent-commerce/cli`](packages/cli) | The CLI, installed as `agent-commerce`. Same surface as MCP, for terminal agents and humans. |
| [`skills/agent-commerce`](skills/agent-commerce) | A skill that teaches coding agents how to use the CLI. |
| [`plugins/cursor`](plugins/cursor) | Cursor plugin: the hosted MCP server, the skill, and a payments rule. Also loads in Grok Bot. |
| [`plugins/claude`](plugins/claude) | Claude Code plugin: the same MCP server and skill. Install with `/plugin marketplace add Crossmint/agent-commerce-sample-app`. |
| [`apps/web`](apps/web) | The reference website: the landing page, the app, the API, the MCP endpoint. |

## How it flows

1. The agent runs `agent-commerce checkout create --url ... --max-cost 50` and Crossmint starts buying the item in a real browser. No card is asked for yet.
2. Partway through, the run reaches its **payment step** and the agent gets an approval link. The user opens it, logs in, and picks one of their saved payment methods. A passkey prompt appears once per device.
3. That mints an **agent card** for this purchase alone, capped at the max cost and locked to the store. Crossmint pays the store with it, and the agent polls until the receipt lands.

An agent can also ask for an agent card up front, with `agent-commerce agent-card request --amount 50 --description "Flight to SF"`, and then spend it with `agent-commerce agent-card reveal <id>` — for paying somewhere a checkout cannot reach.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design and [docs/API.md](docs/API.md) for the HTTP contract.

## Design

The site follows the design of the [Crossmint onramp sample app](https://github.com/Crossmint/onramp-sample-app): a white ground with a dot grid, one blue accent, system sans for text and a display face for money figures only. The app is one Next.js page with a device mockup and an experience switcher at `/app`: Mobile, Desktop, iMessage, Agent MCP and CLI skill show the same flow from each side. The standalone screens (log in, approve, authorize an agent, the CLI callback) stand on the same phone mockup. Theme tokens live in `packages/ui/src/styles.css`; the frames live in `apps/web/components/frame/`.

## Run it locally

```bash
pnpm install
cp .env.example .env
pnpm dev
```

You need a Crossmint staging project, a Stytch project, and a Postgres URL. See `.env.example`. Agent Checkouts only work with a production Crossmint key.

Then, in another terminal:

```bash
pnpm --filter @agent-commerce/cli build
node packages/cli/dist/bin.js login --api http://localhost:3000/api/agent-commerce
node packages/cli/dist/bin.js agent-card request --amount 5 --description "Test" --wait
```

## License

MIT
