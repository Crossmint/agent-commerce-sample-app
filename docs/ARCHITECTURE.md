# Agent Commerce architecture plan

Agent Commerce is an open source monorepo. It shows how to add an **agentic commerce wallet** to your platform. A user saves cards. An agent asks for a bounded budget on one of those cards. The user approves. The agent then pays with a scoped card number, or lets Crossmint Agent Checkouts buy on its behalf.

Agent Commerce is not a crypto wallet. It wraps the Crossmint Agents APIs and adds the pieces Crossmint does not ship: the approval UI, the agent-side tooling, and the glue between them.

This document is the plan. It describes the packages, what each one contains, how they connect, and how a developer picks what to copy.

---

## 1. Mental model

Four actors:

| Actor | Role |
|---|---|
| **User** | Owns the card. Approves budgets. Uses a browser. |
| **Platform** | Your product. Hosts the Agent Commerce server and the wallet website. Owns auth. |
| **Agent** | Runs anywhere: Claude Code, ChatGPT, WhatsApp, your own chat UI. Has no browser. |
| **Crossmint** | Stores the card in a PCI vault. Mints scoped card numbers. Runs checkouts. |

Four primitives, all backed by Crossmint:

| Agent Commerce name | Crossmint object | What it is |
|---|---|---|
| **Payment method** | `payment-methods/{id}` | A saved card. Created in the browser with the `CrossmintPaymentMethodManagement` component. |
| **Agent card** | `order-intents/{id}` | A bounded allowance on one payment method: amount, description, expiry, optional merchant. |
| **Credential** | `order-intents/{id}/credentials` | A scoped card number minted from an active agent card. |
| **Checkout** | `agent-checkouts/{id}` | A Crossmint-run purchase at any URL, paid with a credential. |

### Naming decision: "agent card"

The Crossmint API path says `order-intents`. The Crossmint API reference titles say "Agent Cards". Users and agents understand "agent card" without explanation. "Order intent" describes the API, not the user experience.

Recommendation:

- Use **agent card** in every user-facing string, CLI command, MCP tool, and README.
- Keep `orderIntent` only inside `@agent-commerce/core` types that mirror Crossmint responses.
- Never expose both names in the same surface.

Alternatives considered: "spend permit", "allowance", "budget", "mandate". All are correct. None are better than the name Crossmint and Ramp already use in market.

### The one hard constraint that shapes everything

Almost every Crossmint agents API needs **a client API key plus the user's JWT**. Save card, register card, create agent card, list, mint credentials, revoke: all of them.

Two steps can only happen in a browser:

1. Saving a card. The PCI component runs in the browser. Card data never touches your servers.
2. Verifying a Visa or Mastercard rail. The `OrderIntentVerification` component runs in the browser over HTTPS. It may create a passkey.

Everything else can run anywhere, as long as the caller has a valid JWT for the user.

The agent runs outside the browser. So the agent must **log in as the user**, the same way the browser does. The CLI and the MCP client obtain a normal user session through a browser login, keep it fresh, and send the user's JWT on every call. The Agent Commerce server verifies that JWT and forwards it to Crossmint. There is no second identity system. Auth is the platform's normal user auth, everywhere.

---

## 2. Package map

```
agent-commerce-sample-app/
├── packages/
│   ├── core/        @agent-commerce/core     Typed Crossmint client + domain logic. No framework.
│   ├── auth/        @agent-commerce/auth     UserAuth interface + adapters (Stytch, generic JWKS).
│   ├── server/      @agent-commerce/server   Agent Commerce HTTP API as portable route handlers. Storage interface.
│   ├── ui/          @agent-commerce/ui       React components for save card, approve, verify, checkout.
│   ├── mcp/         @agent-commerce/mcp      MCP server exposing the Agent Commerce API as tools. OAuth.
│   └── cli/         agent-commerce        CLI exposing the Agent Commerce API as commands. Ships a skill.
├── apps/
│   └── web/                        Reference website. Wallet pages + agent chat + API + MCP endpoint.
├── skills/
│   └── agent-commerce/                     SKILL.md for Claude Code, OpenClaw and similar agents.
├── plugins/
│   ├── cursor/                     Cursor plugin (marketplace manifest at .cursor-plugin/): MCP endpoint, skill, rule.
│   └── claude/                     Claude Code plugin (marketplace manifest at .claude-plugin/): MCP endpoint, skill.
└── docs/
```

Dependency direction:

```mermaid
graph TD
  core["@agent-commerce/core"]
  auth["@agent-commerce/auth"]
  server["@agent-commerce/server"]
  ui["@agent-commerce/ui"]
  mcp["@agent-commerce/mcp"]
  cli["agent-commerce (CLI)"]
  web["apps/web"]
  skill["skills/agent-commerce"]

  server --> core
  server --> auth
  ui --> core
  mcp --> server
  cli -. HTTP .-> server
  skill -. wraps .-> cli
  web --> server
  web --> ui
  web --> mcp
```

Rules:

- `@agent-commerce/core` depends on nothing from Agent Commerce. It is the only package that talks to Crossmint.
- `@agent-commerce/ui` never calls Crossmint directly except through the two Crossmint React components. All other data goes through the Agent Commerce API.
- The CLI and the MCP server never hold Crossmint keys. They hold the user's own session and talk to the Agent Commerce API.
- The app is the example. Packages are the product.

---

## 3. Packages in detail

### 3.1 `@agent-commerce/core`

**Purpose.** One typed client for the Crossmint Agents APIs, plus the domain rules Crossmint leaves to you.

**Contents.**

- `CrossmintClient`: fetch-based. Constructor takes `{ clientApiKey, serverApiKey, environment }`. Every method takes a `{ jwt }` user context when Crossmint requires one. Method names mirror Crossmint one to one so they can be checked against the docs.
  - `paymentMethods.list / get / delete / registerForOrderIntents`
  - `orderIntents.create / list / get / revoke / mintCredential`
  - `checkouts.create / get / submitAction / createBuyerProfile`
  - `AgentCard` is exported as a type alias of `OrderIntent`. The rename to "agent card" happens in `@agent-commerce/server`.
- Types that mirror Crossmint responses: `OrderIntent`, `OrderIntentRail` (the `agentic-token` / `encrypted-card` / `spt` discriminated union), `Credential`, `Checkout`, `PendingUserAction`.
- `selectRail(orderIntent, preference)`: picks the rail to use. Fixed order: `agentic-token` (VIC or Agent Pay) if active, then `encrypted-card`. The Stripe `spt` rail is never used or shown.
- `EncryptedCardRail` helpers: generate an RSA-2048 JWK pair, pass the public key, decrypt the response with the private key.
- `EncryptedCardRail` fallback is best effort. Crossmint enforces the amount on network rails. It does **not** enforce it on `encrypted-card`. Agent Commerce passes the amount through, marks the response `enforced: false`, and documents this.
- `pendingActionOf(checkout)` flattens a run's `requiredAction` into `{ id: requestId, question, expiresAt, responseSchema }`; `renderPendingAction` walks that JSON Schema into a neutral field list. UI and CLI both render from it. `submitResponse` / `declineResponse` / `alternativeResponse` build the `input_response` message parts.
- `pollCheckout(id, { interval: 1500 })`: async iterator over status changes. Agent Checkouts have no webhooks.

**Runs on.** Server. Browser for types only.

**Does not contain.** Auth. Storage. HTTP routes. React.

### 3.2 `@agent-commerce/auth`

**Purpose.** Make "bring your own auth" a small, explicit job. Auth is the platform's normal user auth. Stytch is the default. Crossmint verifies the JWT against the provider's JWKS. Agent Commerce adds nothing on top.

**Interfaces.**

```ts
interface UserAuth {
  // Verify a user JWT from a browser or an agent. Returns the user, or null.
  verify(jwt: string): Promise<{ userId: string; email?: string } | null>;
  // Optional. Exchange a long-lived session for a fresh short-lived JWT.
  // Stytch: sessions.authenticate(session_token). Auth0: refresh token grant.
  refresh?(session: string): Promise<{ jwt: string; expiresAt: Date }>;
}
```

That is the whole contract. The browser, the CLI, and the MCP client all send `Authorization: Bearer <user jwt>`. The server calls `verify`, then forwards the same JWT to Crossmint with the client API key.

**Adapters shipped.**

- `@agent-commerce/auth/stytch`: `verify` against the Stytch JWKS. `refresh` with the Stytch session token. Stytch sessions can last up to a year. JWTs last minutes. Refresh keeps the agent working without a new login.
- `@agent-commerce/auth/generic-jwks`: `verify` only, for any provider with a JWKS URL. Use this when your platform already has auth and only needs to hand Agent Commerce a JWT.

**How the agent gets a user session.**

Both the CLI and MCP clients log in with **OAuth 2.1 against Stytch Connected Apps**. Connected Apps turns the Stytch project into an OAuth authorization server. Agent Commerce writes no auth code and stores no auth state.

- **CLI.** `agent-commerce login` reads `GET /v1/config`, then runs the PKCE flow with a loopback redirect, the same as `gh auth login`. It opens the browser to the wallet's `/oauth/authorize` page, the Authorization URL registered in Stytch. The user logs in as normal, Stytch's `IdentityProvider` component shows the consent screen, and Stytch redirects to `http://127.0.0.1:<port>/callback` with the code. The token endpoint is `https://test.stytch.com/v1/public/<project id>/oauth2/token`, or your custom Stytch domain. The CLI exchanges it for an access token and a refresh token. For a remote shell with no local browser, `agent-commerce login --code` uses the redirect `<webBaseUrl>/cli-callback`, a public page that shows the code with a copy button, and the user pastes it back.
- **MCP.** The MCP host discovers the authorization server from the Agent Commerce MCP endpoint metadata and runs the same OAuth flow itself. It manages refresh on its own.

Crossmint verifies JWTs against the Stytch session JWKS. In practice Stytch signs Connected Apps access tokens with the same project keys, so Crossmint accepts an agent's access token directly and the exchange below is a fallback that only runs when a token verifies against the IdP key set alone. On first sight of an access token it calls Stytch's access token exchange, gets a session token plus a session JWT, and stores them in `agent_sessions` keyed by a hash of the access token. Later requests reuse the stored JWT and refresh it through the session token. Stytch only allows the exchange for **first-party** clients with full access, within five minutes of issuance, once per token. The CLI app is **First-party, Public** with full access on. The MCP app is **Third-party, Public**: external hosts get a Stytch consent screen, and its tokens skip the exchange because Crossmint accepts them directly.

Every connected CLI or MCP host is a Stytch session on the user. The wallet's "Connected agents" list reads Stytch sessions and revokes them through Stytch.

**Settled.** Crossmint accepts any JWT it can verify against the configured JWKS, with the user id in `sub`. Stytch signs Connected Apps access tokens with the same project keys as session JWTs, so the MCP path should work with the access token as is. If a call rejects it, `@agent-commerce/auth/stytch` exchanges the access token for a session with the Stytch `sessions.exchange_access_token` endpoint and forwards the session JWT instead. The MCP server never sees this detail.

**Settled.** The docs only describe `x-crossmint-user-id` for Agent Checkouts. Agent Commerce assumes it does not work for order intents. Every order-intent call carries the user's JWT. Agent Checkouts use the server key with `x-crossmint-user-id`, as documented.

### 3.3 `@agent-commerce/server`

**Purpose.** The Agent Commerce HTTP API. This is what the CLI, MCP server, and UI talk to.

**Shape.** Web-standard `(req: Request) => Promise<Response>` handlers. They mount in one Next.js catch-all route and nothing else is needed. The same handlers run in any runtime that speaks `Request` and `Response`.

```ts
// apps/web/app/api/agent-commerce/[...path]/route.ts
import { createAgentCommerceHandlers } from "@agent-commerce/server";

const handlers = createAgentCommerceHandlers({
  crossmint: { clientApiKey, serverApiKey, environment },
  userAuth: stytchUserAuth,
  store: drizzleRequestStore(db), // or memoryRequestStore() for tests
  encryptedCardKeyPair,           // RSA JWK pair for the fallback rail
  baseUrl: "https://wallet.example.com",
});

export const { GET, POST, DELETE } = handlers;
```

**Routes.** One auth plane. Every route takes `Authorization: Bearer <user jwt>`. The browser sends the Stytch JWT from its session. The CLI and MCP client send the JWT they received at login. The server verifies it, then forwards it to Crossmint.

A request from an agent is a request from the user. An agent sees every agent card the user has, the same as the wallet page does. Scoping agent cards per agent would need state, so the reference does not do it. The requester's label goes into the order intent `description`, for example "Claude Code: flight to SF", so the user can tell them apart in the list.

**One table.** Stytch owns users and sessions. Crossmint owns cards, agent cards, credentials, and checkouts. Agent Commerce stores only the thing neither of them has: the agent's pending request, from the moment the agent asks to the moment the user approves or denies. That is one table, `agent_card_requests`, behind a small `RequestStore` interface.

| Route | Caller | Purpose |
|---|---|---|
| `GET /v1/config` | none | Public: Stytch project, OAuth endpoints, client ids, web URL. Lets `agent-commerce login` work from the API URL alone. |
| `GET /v1/me` | user, agent | Who am I. |
| `GET /v1/payment-methods` | user, agent | List saved cards. Masked. Proxies Crossmint. |
| `POST /v1/payment-methods/:id/register` | user | Register a saved card for agent cards. Returns rails. |
| `DELETE /v1/payment-methods/:id` | user | Delete a saved card. |
| `POST /v1/agent-card-requests` | agent | Agent asks for a budget. Server stores it as `pending` and returns `{ requestId, approvalUrl }`. |
| `GET /v1/agent-card-requests/:id` | agent, user | Poll. `pending` → `approved` → `active`, or `denied` / `expired`. Carries `agentCardId` once created. |
| `POST /v1/agent-card-requests/:id/approve` | user | User picked a card. Server registers it if needed, creates the order intent with the user's JWT, stores the id. Returns the order intent for the verification component. |
| `POST /v1/agent-card-requests/:id/verified` | user | Page reports verification done. Server re-reads the order intent and marks the request `active`. |
| `POST /v1/agent-card-requests/:id/deny` | user | Marks `denied`. The agent's next poll sees it. |
| `GET /v1/agent-cards` | user, agent | List. Proxies Crossmint. |
| `GET /v1/agent-cards/:id` | user, agent | Balance, rails, status. |
| `POST /v1/agent-cards/:id/credentials` | agent | Mint a scoped card number. Server picks the rail. |
| `DELETE /v1/agent-cards/:id` | user, agent | Revoke. |
| `POST /v1/checkouts` | agent | Create an Agent Checkout. Server uses the **server** Crossmint key plus `x-crossmint-user-id`. |
| `GET /v1/checkouts/:id` | agent, user | Status. Includes the open `pendingUserAction` and `embedUrl`. When the open request asks for card fields the server mints a credential and answers it itself. The agent never sees the PAN. |
| `POST /v1/checkouts/:id/messages` | agent, user | Answer the open request (`submit` values, `decline`, `alternative` text) or send the agent a note. Card fields are refused. |
| `GET /v1/checkouts/:id/messages` | agent, user | The run's transcript. |
| `POST /v1/checkouts/:id/cancel` | agent, user | Stop the run. |

**Storage.** One interface, two implementations.

```ts
interface RequestStore {
  create(req: NewAgentCardRequest): Promise<AgentCardRequest>;
  get(id: string): Promise<AgentCardRequest | null>;
  update(id: string, patch: Partial<AgentCardRequest>): Promise<AgentCardRequest>;
}
```

`agent_card_requests`: id, user id (Stytch subject), requester label, amount, currency, description, merchant, expires at, status, crossmint order intent id, created at, updated at.

`agent_sessions`: access token hash, user id, Stytch session token, current session JWT, JWT expiry. Written when an agent's access token is exchanged. `checkouts`: checkout id, user id, agent card id.

`@agent-commerce/server/drizzle` ships the Postgres schema and the Drizzle implementation. `memoryRequestStore()` is for tests and for a first `pnpm dev` without a database. The web app points both the chat template and this table at the same Postgres.

Credential issuance is logged, not stored: rail, amount, merchant, agent card id. Never the PAN.

### 3.4 `@agent-commerce/ui`

**Purpose.** React components a platform drops into its own site, and the same components the web app uses.

**Components.**

- `<AgentCommerceProvider apiBaseUrl getJwt>`: wires the Agent Commerce API to the user's session JWT from Stytch. `<CrossmintScope>` mounts Crossmint's browser SDK only around the components that need it (save card, verification), so the page tree never changes shape after hydration.
- `<SaveCard onSaved>`: wraps `CrossmintPaymentMethodManagement`. Then calls register. Reports which rails came back `enabled`.
- `<CardPicker>`: a dropdown of saved cards, each with the network artwork Crossmint sends on `display.imageUrl`, brand and last four, the default marked. "Add a new card" sits under a rule at the foot of the list and opens `SaveCard` on its own surface — a bottom sheet under `sm`, a modal above it (`<AddCardDialog>`). With no cards saved there is nothing to pick from, so the form takes the dropdown's place.
- `<ApproveAgentCard requestId>`: the full approval screen, one column at every width. Shows what is asked, how much, for what. `CardPicker` inside. On approve, calls the server, receives the order intent, mounts `<VerifyAgentCard>` if a rail is `pending_verification`. Ends on a check and a line saying the tab can be closed. `variant="plain"` drops its panel for a page that frames it itself, which is what `/approve` does with a grid cell; the default `"card"` keeps the panel for hosts that drop it into a page, such as the chat. `platformName` (default "Agent Commerce") is the name the card network shows in its confirmation window — the platform, never the agent.
- `<VerifyAgentCard orderIntent>`: wraps `OrderIntentVerification`. Accepts the `appearance` prop. A verification that fails, or a card that came back with no verification step at all, offers "Try again" and "Use a different card" — the second answer replaces the card, which the server allows while the request is `approved`.
- `<AgentCardList>`: list, balance, revoke.
- `<CheckoutView checkoutId>`: polls, renders `embedUrl` in a view-only iframe, renders the open `pendingUserAction` from its JSON Schema via `<PendingActionForm>` (with skip and cancel), and ends with the receipt or the blocked/failed summary.
- `<ConnectedAgents>`: the user's Stytch sessions, with labels and a revoke button.

Two layers: headless hooks (`useAgentCardRequest`, `useCheckout`, ...) and styled components on top. Styled with CSS variables so a platform can retheme without forking.

### 3.5 `@agent-commerce/mcp`

**Purpose.** Expose the Agent Commerce API to MCP clients: ChatGPT, Claude, and any host that speaks MCP over streamable HTTP with OAuth.

**Tools.** Names mirror the CLI one to one. Titles, summaries and parameter docs come from `TOOL_DOCS` in `@agent-commerce/core` (`tool-docs.ts`), shared with the chat agent in `apps/web`; each surface appends one sentence about how the result reaches the user (a link to approve on MCP, an inline component in the chat; card fields shown on MCP, masked in the chat). A test in `packages/mcp` checks every description opens with the shared summary.

- `list_payment_methods`
- `request_agent_card({ amount, currency, description, merchant?, expiresInHours })` → approval URL. The tool result tells the model to show the link to the user.
- `get_agent_card({ agentCardId })`
- `list_agent_cards`
- `reveal_agent_card({ agentCardId, amount?, currency?, merchant? })` → card number, expiry, CVC. Gated by scope `credentials:mint`.
- `create_checkout({ startUrl, task?, agentCardId?, maxCost, currency?, buyerProfileId?, browserProfileId?, merchantGuidance? })`. `agentCardId` is optional: without one the run raises its payment step and the user chooses a payment method there.
- `get_checkout({ checkoutId })`
- `answer_checkout({ checkoutId, requestId?, action?, values?, text? })`
- `cancel_checkout({ checkoutId })`
- `revoke_agent_card({ agentCardId })`

Auth: OAuth 2.1 with Stytch Connected Apps as the authorization server. The MCP server is stateless. It forwards the bearer token to the Agent Commerce API, which verifies it with `UserAuth.verify`.

Deployment: mounted at `/api/mcp` inside the web app, or run standalone with `npx @agent-commerce/mcp --api https://wallet.example.com`.

### 3.6 `agent-commerce` (CLI)

**Purpose.** The same surface as MCP, for terminal agents like Claude Code and for humans.

```
agent-commerce login [--api https://wallet.example.com]   # device-link flow; prints a URL
agent-commerce cards list                                 # saved payment methods
agent-commerce agent-card request --amount 50 --description "Flight to SF"  [--merchant united.com] [--wait]
agent-commerce agent-card status <requestId> [--wait]        # resume waiting after a timeout
agent-commerce agent-card list | get <id> | revoke <id>
agent-commerce agent-card reveal <id> [--amount 25]       # prints card number, expiry, cvc; --json
agent-commerce checkout create --url <product url> --max-cost 100 [--task "medium, black"] [--agent-card <id>] [--buyer-profile <id>] [--wait]
agent-commerce checkout get <id> | answer <id> <requestId> --values '{...}' | --decline | --alternative "<text>"
agent-commerce checkout message <id> "<note>" | cancel <id>
agent-commerce whoami | logout
```

Every command has `--json`. `--wait` polls until a terminal state. The `request` command prints the approval URL and, with `--wait`, blocks until the card is active.

The `agent-commerce` npm name already belongs to you. The last publish was `1.1.2` in 2024, so the first Agent Commerce release should be `2.0.0`.

Config lives in `~/.config/agent-commerce/config.json`: API base URL, OAuth access token, refresh token. No Crossmint keys on the machine. `agent-commerce logout` revokes the Stytch session.

### 3.7 `skills/agent-commerce`

A `SKILL.md` that teaches a coding agent when and how to use the CLI. It covers: log in first, request before reveal, show the approval URL to the user, prefer `checkout create` over `reveal` when the target is a website, never paste a revealed card number into chat logs. Published alongside the CLI so `npx skills add crossmint/agent-commerce-sample-app` or a plain copy works.

### 3.8 `apps/web`

Next.js App Router. The reference deployment and the "copy me" target. It is one website: a landing page, one app page that shows the flow inside a device mockup, and the standalone screens an agent's link opens.

```
apps/web/app/
├── page.tsx                     the landing page
├── app/                         the app: one page, a device mockup, and an experience switcher
│                                (Mobile, Desktop, iMessage, Agent MCP, CLI skill). Saved cards,
│                                agent cards, connected agents and the agent chat live inside it
├── login/, authenticate/        Stytch login and redirect callback, on the phone screen
├── (approve)/approve/[requestId]/  approve an agent card request (the link agents send). Its own
│                                group: one decision, session checked in the layout
├── checkouts/[id]/              watch a checkout, answer actions. A desktop window; session checked in the layout
├── oauth/authorize/             the Connected Apps Authorization URL: the sample app's own consent screen on
│                                Stytch's headless `idp` calls
├── cli-callback/                shows the OAuth code for `agent-commerce login --code`
├── install/route.ts             markdown for agents: "Set up https://<host>/install" installs the CLI and the skill
├── not-found.tsx                any URL that is not there
├── .well-known/oauth-protected-resource/  RFC 9728 metadata so MCP hosts find Stytch
├── api/agent-commerce/[...path]/route.ts  the HTTP API from @agent-commerce/server
├── api/mcp/route.ts             the MCP endpoint from @agent-commerce/mcp
└── api/chat/route.ts            streamText with tools. Only file that imports the model provider
```

**The app** is what an external agent needs. CLI and MCP users only ever see `/approve`, `/checkouts/[id]` and `/app`. Deploy this and you have a hosted place for users to approve budgets.

**The chat** shows the in-process integration, as one of the experiences inside `/app`. It uses the AI SDK with `streamText` and `useChat`, Postgres through Drizzle for chat history, Vercel Blob for attachments, and AI Elements for the UI, with Stytch as the login.

Tools are defined once in `api/chat/route.ts` and call `@agent-commerce/core` directly in the same process, no HTTP round trip. Inline approval works through AI SDK tool parts. The model calls `request_agent_card`. The stream carries the tool call to the client. The message renderer sees a part of that tool type and renders `<ApproveAgentCard>` in its place. When the user approves, the client calls `addToolResult` with the new agent card id and the model continues. The tool has no server-side execute function for this step, which is the AI SDK pattern for human-in-the-loop tools.

The chat is optional. Delete `components/chat` and `api/chat` and the app still builds. The chat experience hides when no model key is set.

One login covers everything. The approval screen in the chat and the approval screen at `/approve` are the same component with the same session.

---

## 4. Flows

### 4.1 Agent outside the browser (CLI, MCP, WhatsApp)

```mermaid
sequenceDiagram
  participant A as Agent (CLI / MCP)
  participant S as Agent Commerce server
  participant W as Wallet website
  participant X as Crossmint

  Note over A: holds a Stytch access token from OAuth login
  A->>S: POST /agent-card-requests {amount, description} (user JWT)
  S-->>A: {requestId, approvalUrl}  (stored as pending)
  A-->>A: shows approvalUrl to the user
  Note over W: user opens approvalUrl, logs in
  W->>S: GET /agent-card-requests/:id → request details
  W->>X: (optional) save card via PCI component, using the user JWT
  W->>S: POST /agent-card-requests/:id/approve {paymentMethodId}
  S->>X: PUT payment-methods/:id/order-intent-registration (user JWT)
  S->>X: POST order-intents (user JWT), store orderIntentId
  S-->>W: order intent with rails
  W->>X: OrderIntentVerification component (passkey)
  W->>S: POST /agent-card-requests/:id/verified
  S->>X: GET order-intents/:id → rail active, mark request active
  loop until active, denied or expiresAt
    A->>S: GET /agent-card-requests/:id
  end
  A->>S: POST /agent-cards/:id/credentials (user JWT)
  S->>X: POST order-intents/:id/credentials (user JWT, chosen rail)
  S-->>A: card number, expiry, cvc
```

### 4.2 Agent checkout instead of a raw card

Same start. After the agent card is active:

```mermaid
sequenceDiagram
  participant A as Agent
  participant U as User
  participant S as Agent Commerce server
  participant X as Crossmint

  A->>S: POST /checkouts {url, request, maxCost}
  S->>X: POST agent-checkouts (server key + x-crossmint-user-id)
  loop every 1.5 s
    A->>S: GET /checkouts/:id
    S->>X: GET agent-checkouts/:id
  end
  Note over S: status awaiting_user_action, type payment
  S->>S: create an agent card request for maxCost, locked to the store
  S-->>A: paymentRequest {requestId, approvalUrl}
  Note over A: shows the link; the user picks a payment method
  U->>S: POST /agent-card-requests/:id/approve {paymentMethodId}
  S->>X: POST order-intents (the agent card)
  A->>S: GET /checkouts/:id
  S->>X: POST order-intents/:id/credentials
  S->>X: POST agent-checkouts/:id/messages {input_response: card}
  Note over A: a shipping or size question comes back to the agent instead
  A->>S: POST /checkouts/:id/messages {requestId, values}
  S-->>A: status succeeded, receipt
```

The agent never holds a card number in this path, and never sees the store's card form: the server answers it from a credential it mints. What changes with the payment step is *when* the agent card is made. A checkout created with an `agentCardId` pays from it silently. One created without — the ordinary case, where the user just asked to buy something — reaches the payment step with nothing to pay from, so the server raises an agent card request scoped to the run's `maxCost` and locked to the store, and hands it back as `paymentRequest`. The user chooses a payment method there, and the next poll pays with the card that mints. One request per run: it is reused on every poll, and a denial sticks.

That is the preferred path and the skill says so. Asking for an agent card up front is for spending somewhere a checkout cannot reach.

### 4.3 Agent inside a web app (the chat half of apps/web)

No approval URL and no polling. The model's `request_agent_card` tool call streams to the client as a tool part. The chat renders `<ApproveAgentCard>` in that slot. The user approves in place. The client returns the agent card id as the tool result and the model continues.

### 4.4 Rail fallback inside `POST /agent-cards/:id/credentials`

1. Fetch the order intent. Read `rails[]`. Ignore the top-level status.
2. If an `agentic-token` rail is `active`: mint with `provider`, `amount`, and `merchant`. Card networks issue a number per merchant, so when the agent card is not locked to one the caller must name the store. Checkouts derive it from the target URL. Return the card. Crossmint enforces the limit.
3. Else use `encrypted-card`. Mint with the RSA public key, decrypt with the private key, return the card. Crossmint does not enforce the amount on this rail. Agent Commerce does not either. The response carries `enforced: false` so the agent and the skill know the limit is advisory. Prefer `checkout create` on this rail, since the checkout's `maxCost` is enforced by Crossmint.
4. Log rail, amount, merchant, agent card id. Never the PAN.

---

## 5. What a developer copies

The README opens with one table:

| You have | You want | Use | Copy |
|---|---|---|---|
| A web app with users | Users save cards and grant your agent budgets | `@agent-commerce/core` `@agent-commerce/server` `@agent-commerce/ui` | the `/app` screens from `apps/web` |
| An agent in Claude Code, ChatGPT, or a chat channel | A hosted place where users approve, plus agent tooling | Deploy `apps/web`. Give agents `agent-commerce` or the MCP URL | Nothing. Configure and deploy. Delete `components/chat` if unwanted |
| Your own auth (Auth0, Clerk, Supabase) | Everything above with your login | Implement `UserAuth.verify` and `refresh` from `@agent-commerce/auth`. Register your JWKS in the Crossmint console | `packages/auth/src/stytch` as a template |
| Your own backend and only need Crossmint calls | The thin typed client | `@agent-commerce/core` only | Nothing |
| A chat product | Approve cards inline in the conversation | `@agent-commerce/ui` + `@agent-commerce/server` in process | `components/chat` and `api/chat` from `apps/web` |

Then a five-minute local quickstart: clone, `pnpm i`, copy `.env.example`, point `DATABASE_URL` at a Neon branch or `docker compose up` Postgres, `pnpm db:push`, `pnpm dev`, run `agent-commerce login --api http://localhost:3000`, run `agent-commerce agent-card request`, open the link, approve, run `agent-commerce agent-card reveal`. Staging Crossmint keys work for everything except Agent Checkouts, which are production only.

Each package README repeats the same structure: what it does, what it depends on, the three functions you will call, and a link to where the web app uses it.

---

## 6. Production deployment

The reference deployment is one Vercel project, one Postgres, and one Blob store.

| Piece | Where | Notes |
|---|---|---|
| `apps/web` | Vercel | Serves the landing page, `/app`, the standalone screens, `/api/agent-commerce`, `/api/mcp`. Custom domain with HTTPS. Verification requires HTTPS. |
| Postgres | Neon | One database. Drizzle migrations for the chat template tables and `agent_card_requests`. |
| Vercel Blob | Vercel | Chat attachments, from the template. |
| Stytch project | Stytch | Live environment. Redirect URLs on the wallet domain. Connected Apps enabled: a first-party public client for the CLI (PKCE, full access on, loopback redirect) and a third-party public client for MCP with the hosts' redirect URLs. Session duration set long enough for agents, for example 30 days. |
| Crossmint project | Crossmint console, production | One **client** key with scopes `payment-methods.*`, `order-intents.create/read/credentials/revoke`. One **server** key for `agent-checkouts`. Under JWT authentication choose Custom tokens with JWKS `https://test.stytch.com/v1/sessions/jwks/<stytch project id>`, issuer `stytch.com/<stytch project id>`, verifier `sub`. Or pick the Stytch preset with the project id. |
| RSA key pair | Env var or KMS | 2048-bit, for the `encrypted-card` fallback. Private key never leaves the server. |

Environment variables, all in `.env.example`:

```
CROSSMINT_ENV=production
CROSSMINT_CLIENT_API_KEY=ck_production_...
CROSSMINT_SERVER_API_KEY=sk_production_...
AGENT_COMMERCE_WEB_BASE_URL=https://wallet.example.com
AGENT_COMMERCE_ENCRYPTED_CARD_PRIVATE_KEY=...  # RSA JWK
DATABASE_URL=postgres://...
BLOB_READ_WRITE_TOKEN=...
STYTCH_PROJECT_ID=...
STYTCH_SECRET=...
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=...
STYTCH_CLI_CLIENT_ID=...        # Connected Apps client for `agent-commerce`
STYTCH_MCP_CLIENT_ID=...
ANTHROPIC_API_KEY=...           # optional, enables the chat page
```

What the end user sees in production:

1. Their agent says: "I need $50 for the flight. Approve here: https://wallet.example.com/approve/req_…"
2. They open the link on any device. They log in with Google.
3. They pick a card or add one. They tap Approve. A passkey prompt appears once per device.
4. The page says "Active. Your agent can spend up to $50 until Friday."
5. Back in the chat, the agent continues. Later the wallet shows the agent card, what was spent, and a Revoke button.

For the platform, the CLI is `npm i -g @agent-commerce/cli`. The MCP URL is `https://wallet.example.com/api/mcp`. Both point at the same server.

---

## 7. Design

**Look.** The site follows the design of the Crossmint onramp sample app (`github.com/Crossmint/onramp-sample-app`). It is not a brand of its own: the Crossmint logotype is the only mark. The ground is white with a dot grid, text is neutral grey, `#4564FF` is the one accent, corners step from 10px up to full pills, and money figures are the only thing set in the display face (Mona Sans). The tokens live in `packages/ui/src/styles.css` so an adopter rethemes in one file. The device mockups live in `apps/web/components/frame/`: `DeviceFrame` (a phone), `DesktopFrame` (a window with an address pill), `FramePage` (the dot grid canvas with the logo card top left and the Crossmint footer). `/app` is one page with an experience switcher across the top: Mobile, Desktop, iMessage, Agent MCP and CLI skill show the same flow from each side. The standalone screens (log in, authenticate, approve, authorize an agent, the CLI callback, not found) stand on `components/focus-screen.tsx`: a phone on the canvas, the step's name in 28px, one line under it, tall calls to action. The CLI's own browser callback page repeats the look inline, with no assets to serve.

**Components.** shadcn/ui on Tailwind, installed into `@agent-commerce/ui` so the web app and any adopter get the same primitives. AI Elements for chat, which is shadcn-based too. Theme tokens live in one CSS file in `@agent-commerce/ui` so a platform can retheme without forking.

**The approval screen.** Structure follows a fixed order and never adds to it:

1. Headline: "<Agent> is requesting to use your card".
2. Two labeled lines: Purpose, Limit. Merchant and Expires appear only when set.
3. "Choose card" with a select of saved cards, brand icon plus last four. "Add a new card" at the bottom of the list.
4. One reassurance line with a lock icon: "Your card number is never shared with the agent or the store."
5. One full-width primary button: Allow. A quiet text link under it: Deny.

Verification, when a rail needs it, replaces the button area in place. Success replaces the whole screen with the approved limit as a big blue figure, "Approved" above it, and "Your agent can spend up to <limit> until <date>." under it.

---

## 8. Repo tooling

- pnpm workspaces plus Turborepo. `turbo dev`, `turbo build`, `turbo test`.
- TypeScript everywhere, strict mode, one shared `tsconfig` package. `tsup` for packages. Next.js App Router for apps. React 19.
- Changesets for versioning. Packages publish under `@agent-commerce/*`. The CLI publishes as `agent-commerce`.
- Vitest. `@agent-commerce/core` gets recorded Crossmint fixtures. `@agent-commerce/server` runs against the memory request store with Crossmint and Stytch mocked.
- Drizzle Kit for migrations. One schema package the web app and `@agent-commerce/server/drizzle` share.
- One `.env.example` at the root. Apps read from it in dev.
- `docs/` holds this file, a per-flow guide, and an ADR folder for the decisions in section 9.

---

## 9. Decisions

1. **Name**: settled. "Agent card" everywhere users can see. `orderIntent` only in core types.
2. **Auth**: settled. Normal user auth only. The agent logs in as the user through a browser link and keeps the Stytch session. Order-intent calls always carry the user JWT.
3. **One app**: settled. `apps/web` holds the landing page, the app, the standalone screens, the API, and the MCP endpoint. The chat is one deletable experience inside the app. `@agent-commerce/server` stays portable if anyone wants to split later.
4. **Server shape**: Web-standard request handlers mounted in Next.js route files. No extra framework.
5. **npm scope**: settled. `@agent-commerce/*` for packages. The CLI publishes as `agent-commerce`.
6. **Chat stack**: settled. Vercel AI Chatbot template with Auth.js replaced by Stytch. Postgres and Blob stay. Swapping the model is one line in `api/chat/route.ts`.
7. **Database**: settled. One Postgres. The chat template owns its tables. Agent Commerce adds `agent_card_requests` and nothing else. Stytch holds users and sessions. Crossmint holds everything financial.
8. **Encrypted-card fallback**: settled. Always available, best effort, amount not enforced. Responses say so.

---

## 10. Build order

1. `@agent-commerce/core` against Crossmint staging. Save-card cannot be automated, so the Add card dialog in `apps/web` comes with it.
2. `@agent-commerce/auth` with the Stytch adapter. Register Stytch in the Crossmint staging console. Connected Apps OAuth from the CLI.
3. `@agent-commerce/server` with the memory request store. Approval flow end to end in the web app. Then the Drizzle store.
4. `@agent-commerce/ui` extracted from the web app once the flow works.
5. `agent-commerce` CLI with `login`, `request`, `reveal`. Then the skill.
6. `@agent-commerce/mcp` with OAuth. Test from Claude and ChatGPT.
7. Checkouts, on a production Crossmint key.
8. The chat experience: the AI SDK chat with Stytch as the login and the agent card tools.
9. Changesets, publish.
