# @goat-wallet/mcp

MCP server for the GOAT wallet. It exposes the GOAT HTTP API as tools for Claude, ChatGPT, and any MCP host.

The server is stateless. It holds no Crossmint keys and no sessions. Each request carries the user's bearer token. The server forwards that token to the GOAT API, which verifies it.

Auth is OAuth 2.1. Stytch Connected Apps is the authorization server. This package only publishes the protected resource metadata that points clients to Stytch. Stytch runs the login and issues the token.

## Tools

| Tool | What it does |
|---|---|
| `list_payment_methods` | Saved cards, masked. |
| `request_agent_card` | Ask the user for a spending limit. Returns `requestId` and `approvalUrl`. |
| `get_agent_card_request` | Poll a request until `active`, `denied`, `expired` or `failed`. |
| `list_agent_cards` | Agent cards with balance and expiry. |
| `get_agent_card` | One agent card. |
| `reveal_agent_card` | Mint a scoped card number. Returns `enforced`. Warns when the limit is advisory. |
| `revoke_agent_card` | Revoke an agent card. |
| `create_checkout` | Let Crossmint buy at a URL with an agent card. The card number never reaches the agent. |
| `get_checkout` | Checkout status. Lists pending question fields. |
| `answer_checkout_action` | Answer a pending checkout question. |

Every tool returns `structuredContent` and a text summary.

## Mount in Next.js

The reference app mounts the GOAT API at `/api/goat` and the MCP endpoint at `/api/mcp`.

`app/api/mcp/route.ts`:

```ts
import { createGoatMcpHandler } from "@goat-wallet/mcp";
import { stytchEndpoints } from "@goat-wallet/auth";

const base = process.env.GOAT_BASE_URL!; // https://wallet.example.com
const stytch = stytchEndpoints({ projectId: process.env.STYTCH_PROJECT_ID! });

const handler = createGoatMcpHandler({
  apiBaseUrl: `${base}/api/goat`,
  resourceUrl: `${base}/api/mcp`,
  authorizationServers: [stytch.authorize.replace(/\/oauth2\/authorize$/, "")],
  scopes: ["openid", "email", "profile", "offline_access"],
  requester: "GOAT MCP",
});

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
```

`app/.well-known/oauth-protected-resource/route.ts`:

```ts
import { createProtectedResourceMetadataHandler } from "@goat-wallet/mcp";

const handler = createProtectedResourceMetadataHandler({
  resourceUrl: `${process.env.GOAT_BASE_URL}/api/mcp`,
  authorizationServers: [/* same list as above */],
  scopes: ["openid", "email", "profile", "offline_access"],
});

export const GET = handler;
export const OPTIONS = handler;
```

Some clients also try the path form from RFC 9728: `/.well-known/oauth-protected-resource/api/mcp`. Add `app/.well-known/oauth-protected-resource/api/mcp/route.ts` with the same handler if you want to serve both.

`authorizationServerFromEndpoint` derives the authorization server from the `authorizationEndpoint` in `GET /v1/config`:

```ts
import { authorizationServerFromEndpoint } from "@goat-wallet/mcp";
authorizationServerFromEndpoint("https://test.stytch.com/v1/public/project-test-123/oauth2/authorize");
// → "https://test.stytch.com/v1/public/project-test-123"
```

### What happens on a request

1. No `Authorization` header: the handler returns `401` with `WWW-Authenticate: Bearer ..., resource_metadata="https://wallet.example.com/.well-known/oauth-protected-resource"`.
2. The client reads the metadata, finds Stytch, and runs OAuth 2.1 with PKCE.
3. The client retries with `Authorization: Bearer <token>`. The handler builds a fresh MCP server for that token and answers with JSON. No session id. No SSE.
4. Each tool calls the GOAT API with the same token.

### Env

The web app needs these to mount the endpoint:

- `GOAT_BASE_URL`: public origin, e.g. `https://wallet.example.com`.
- `STYTCH_PROJECT_ID`: to derive the authorization server URL.
- `STYTCH_MCP_CLIENT_ID`: the Connected Apps client for MCP. The MCP host uses it. Stytch needs the host's redirect URL registered on that client, or dynamic client registration enabled.

## Connect from Claude or ChatGPT

Add a remote MCP server with the URL:

```
https://wallet.example.com/api/mcp
```

The host opens the Stytch login. The user logs in as usual. The tools then appear in the chat.

## Stdio for local hosts

For Claude Code, Claude Desktop, Cursor, and other local hosts:

```sh
goat login --api https://wallet.example.com      # from the goat CLI, once
npx @goat-wallet/mcp --api https://wallet.example.com
```

`goat-mcp` reads the token from `GOAT_TOKEN`, else from `~/.config/goat/config.json` (`accessToken`, written by `goat login`). A URL with no path maps to `<url>/api/goat`. A URL with a path is used as given.

Claude Code:

```sh
claude mcp add goat -- npx @goat-wallet/mcp --api https://wallet.example.com
```

Options: `--requester "Claude Code"` sets the name the user sees on approvals. `--token <jwt>` overrides the token.

## Library use

```ts
import { createGoatMcpServer, registerGoatTools, GoatApi } from "@goat-wallet/mcp";

// One server bound to one token.
const server = createGoatMcpServer({ apiBaseUrl, bearerToken, requester: "My agent" });

// Or add the tools to your own McpServer.
registerGoatTools(myServer, { api: new GoatApi({ baseUrl: apiBaseUrl, bearerToken }) });
```
