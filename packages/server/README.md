# @agent-commerce/server

The Agent Commerce HTTP API as Web-standard request handlers. Mount it in Next.js or any runtime that speaks `Request` and `Response`.

The contract lives in [`docs/API.md`](../../docs/API.md). This package implements it. The UI, CLI and MCP server call it.

## Install

```sh
pnpm add @agent-commerce/server @agent-commerce/core @agent-commerce/auth
# optional, for Postgres storage
pnpm add drizzle-orm
```

## Mount in Next.js

Create `app/api/agent-commerce/[...path]/route.ts`:

```ts
import { createAgentCommerceHandlers } from "@agent-commerce/server";
import { drizzleRequestStore } from "@agent-commerce/server/drizzle";
import { createStytchUserAuth } from "@agent-commerce/auth/stytch";
import { parsePrivateJwk } from "@agent-commerce/core";
import { db } from "@/lib/db";

export const { GET, POST, PUT, DELETE } = createAgentCommerceHandlers({
  crossmint: {
    clientApiKey: process.env.CROSSMINT_CLIENT_API_KEY!,
    serverApiKey: process.env.CROSSMINT_SERVER_API_KEY,
    environment: "staging",
  },
  userAuth: createStytchUserAuth({ projectId: process.env.STYTCH_PROJECT_ID! }),
  store: drizzleRequestStore(db),
  encryptedCardPrivateJwk: process.env.AGENT_COMMERCE_ENCRYPTED_CARD_JWK
    ? parsePrivateJwk(process.env.AGENT_COMMERCE_ENCRYPTED_CARD_JWK)
    : undefined,
  webBaseUrl: "https://wallet.example.com",
  apiBaseUrl: "https://wallet.example.com/api/agent-commerce",
  auth: {
    provider: "stytch",
    projectId: process.env.STYTCH_PROJECT_ID!,
    environment: "test",
    cliClientId: process.env.STYTCH_CLI_CLIENT_ID,
    mcpClientId: process.env.STYTCH_MCP_CLIENT_ID,
  },
});
```

The router finds the mount point by locating `/v1/` in the URL path. Any prefix works.

For a first run without a database, use `memoryRequestStore()`. It forgets everything on restart.

## Other runtimes

`createAgentCommerceHandlers` also returns `handler`. It dispatches on `req.method`.

```ts
const { handler } = createAgentCommerceHandlers({ ... });
Bun.serve({ fetch: handler });
```

## Storage

Agent Commerce stores one thing: the agent's pending request, until the user answers. It also stores which agent card pays for each checkout.

`RequestStore` is the interface. Implement `create`, `get`, `update`, and optionally `listByUser`. Add `linkCheckout` and `getCheckout` (the `CheckoutStore` interface) to persist checkout links. If you leave them out, the server keeps the links in memory and logs a warning.

`@agent-commerce/server/drizzle` ships both tables and a store for any Drizzle Postgres driver:

```ts
import { agentCardRequests, checkouts, drizzleRequestStore } from "@agent-commerce/server/drizzle";
```

Generate the migration with drizzle-kit from `agentCommerceSchema`, or run this SQL:

```sql
create table agent_card_requests (
  id text primary key,
  user_id text not null,
  requester text not null,
  amount jsonb not null,
  description text not null,
  merchant jsonb,
  expires_at timestamptz not null,
  request_expires_at timestamptz not null,
  status text not null,
  agent_card_id text,
  payment_method_id text,
  failure_reason text,
  approval_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table checkouts (
  id text primary key,
  user_id text not null,
  agent_card_id text not null,
  created_at timestamptz not null default now()
);
```

## What the server does for you

- Verifies the bearer token with your `UserAuth`. Forwards the same JWT to Crossmint.
- On approve: registers the card for agent cards, creates the order intent, and marks the request `active` or `approved`.
- On credentials: picks the rail with `selectRail`, mints, and decrypts the encrypted-card rail with your RSA key. Returns `enforced: false` when Crossmint does not cap the rail.
- On checkouts: when Crossmint asks for a card, mints one from the linked agent card and answers. Callers never see card fields.
- Logs every mint: rail, amount, agent card id. Never the card number.

## Errors

Every error is `{ "error": { "code", "message", "details"? } }`. Crossmint failures become `crossmint_error` with `details.status` and `details.body`. A Crossmint 401 or 403 becomes `401 unauthorized`.
