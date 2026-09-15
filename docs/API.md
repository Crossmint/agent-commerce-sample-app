# GOAT HTTP API contract

This is the contract between `@goat-wallet/server` (implements it), `@goat-wallet/ui` (browser caller), `goat` CLI and `@goat-wallet/mcp` (agent callers). All four must match this file. Change the file first, then the code.

Base path: the server is mounted at a prefix, in the reference app `/api/goat`. All paths below are relative to that prefix. Version segment `v1` is part of the path.

## Auth

Every route except `GET /v1/config` requires `Authorization: Bearer <user jwt>`. The JWT is a Stytch session JWT (browser) or a Stytch Connected Apps access token (CLI, MCP). The server calls `UserAuth.verify`. On failure: `401 { "error": { "code": "unauthorized", "message": "..." } }`.

The verified JWT is forwarded as is to Crossmint on every payment-method and order-intent call. Agent Checkouts use the server key plus `x-crossmint-user-id: <userId>`.

## Errors

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

Codes: `unauthorized`, `forbidden`, `not_found`, `invalid_request`, `expired`, `no_usable_rail`, `crossmint_error`, `internal`. `crossmint_error` carries `details.status` and `details.body` from Crossmint.

## Public config

`GET /v1/config` (no auth). Lets a CLI log in knowing only the API URL.

```json
{
  "name": "GOAT",
  "apiBaseUrl": "https://wallet.example.com/api/goat",
  "webBaseUrl": "https://wallet.example.com",
  "crossmintEnvironment": "staging" | "production",
  "auth": {
    "provider": "stytch",
    "projectId": "project-test-...",
    "environment": "test" | "live",
    "oauth": {
      "authorizationEndpoint": "https://test.stytch.com/v1/public/<projectId>/oauth2/authorize",
      "tokenEndpoint": "https://test.stytch.com/v1/public/<projectId>/oauth2/token",
      "cliClientId": "connected-app-...",
      "mcpClientId": "connected-app-...",
      "scopes": ["openid", "email", "profile", "offline_access"]
    }
  }
}
```

## Whoami

`GET /v1/me` → `{ "userId": "user-test-...", "email": "a@b.c" }`

## Payment methods (saved cards)

`GET /v1/payment-methods` → `{ "paymentMethods": PaymentMethod[] }` where `PaymentMethod` is the Crossmint shape from `@goat-wallet/core` (`paymentMethodId`, `type`, `displayName`, `card.brand`, `card.last4`, `card.expiration`). Never a full number.

`POST /v1/payment-methods/:id/register` body `{ "email": string, "countryCode": string, "languageCode"?: string }` → `RegisterCardResult` (`{ paymentMethodId, rails: [{ rail, provider, status }] }`). Idempotent.

`DELETE /v1/payment-methods/:id` → `204`.

## Agent card requests

The agent's ask, stored by GOAT until the user answers.

```ts
type AgentCardRequestStatus = "pending" | "approved" | "active" | "denied" | "expired" | "failed";

interface AgentCardRequest {
  id: string;                    // "acr_" + 21 url-safe chars
  userId: string;
  requester: string;             // "Claude Code", "ChatGPT", app name
  amount: { value: string; currency: string };
  description: string;
  merchant?: { name: string; url: string; countryCode: string };
  expiresAt: string;             // the agent card's expiry, ISO
  requestExpiresAt: string;      // how long the user has to answer, ISO (default 15 min)
  status: AgentCardRequestStatus;
  agentCardId?: string;          // Crossmint orderIntentId once created
  paymentMethodId?: string;
  failureReason?: string;
  approvalUrl: string;           // `${webBaseUrl}/approve/${id}`
  createdAt: string;
  updatedAt: string;
}
```

`POST /v1/agent-card-requests` (agent) body:

```json
{ "amount": { "value": "50.00", "currency": "USD" }, "description": "Flight to SF", "merchant"?: {...}, "expiresInHours"?: 24, "requester"?: "Claude Code" }
```

→ `201 AgentCardRequest` with `status: "pending"`.

`GET /v1/agent-card-requests/:id` → `AgentCardRequest`. Only the owning user. A `pending` request past `requestExpiresAt` is returned as `expired`.

`POST /v1/agent-card-requests/:id/approve` (browser) body `{ "paymentMethodId": string, "email"?: string, "countryCode"?: string }`.
Server: registers the card for order intents (idempotent), creates the order intent with the user JWT, stores `agentCardId`, sets `status: "approved"`, or `"active"` right away if a rail is already active.
→ `{ "request": AgentCardRequest, "agentCard": AgentCard, "needsVerification": boolean }`. `AgentCard` is the Crossmint `OrderIntent` shape.

`POST /v1/agent-card-requests/:id/verified` (browser) → re-reads the order intent. If a rail is active, `status: "active"`. → `{ "request": AgentCardRequest, "agentCard": AgentCard }`.

`POST /v1/agent-card-requests/:id/deny` → `AgentCardRequest` with `status: "denied"`.

## Agent cards (order intents)

`GET /v1/agent-cards` → `{ "agentCards": AgentCard[] }`. Proxies Crossmint list.

`GET /v1/agent-cards/:id` → `AgentCard`.

`DELETE /v1/agent-cards/:id` → `204`. Revokes.

`POST /v1/agent-cards/:id/credentials` (agent) body:

```json
{ "amount"?: { "value": "25.00", "currency": "USD" }, "merchant"?: {...}, "format"?: "card" }
```

Server picks the rail (`selectRail`), mints, decrypts the encrypted-card rail with the server's RSA key, and returns:

```json
{
  "agentCardId": "…",
  "rail": "agentic-token" | "spt" | "encrypted-card",
  "provider"?: "vic" | "agentpay" | "stripe",
  "enforced": true | false,
  "card"?: { "number": "…", "expirationMonth": "12", "expirationYear": "2030", "cvc": "123" },
  "token"?: "spt_…",
  "expiresAt"?: "…"
}
```

`enforced: false` means Crossmint does not cap this rail; the limit is advisory. If no rail is active: `409 { error: { code: "no_usable_rail" } }`.

## Checkouts

`POST /v1/checkouts` (agent) body:

```json
{ "url": "https://shop.example/p/1", "request"?: "medium, black", "agentCardId": "…", "maxCost": { "amount": "100.00", "currency": "USD" }, "buyerProfileId"?: "…" }
```

→ `201 CheckoutView`.

```ts
interface CheckoutView {
  id: string;
  status: string;                       // Crossmint status
  agentCardId?: string;
  pendingUserAction?: PendingUserAction; // Crossmint shape, only non-payment actions reach callers
  rendered?: RenderedAction;            // from renderPendingAction, for UIs
  embedUrl?: string;                    // absolute URL for an iframe
  receipt?: object;
  failure?: { reason: string; message?: string };
}
```

`GET /v1/checkouts/:id` → `CheckoutView`. While polling, if Crossmint reports a **payment** action and the checkout has an `agentCardId`, the server mints a credential and answers the action itself before returning. Callers never see card fields.

`POST /v1/checkouts/:id/actions/:actionId` body `{ "values": {...} }` → `CheckoutView`.

`POST /v1/buyer-profiles` body `BuyerProfileInput` (core) → `{ "id": "…" }`.

## Server config object

```ts
createGoatHandlers({
  crossmint: { clientApiKey, serverApiKey?, environment },
  userAuth: UserAuth,
  store: RequestStore,
  encryptedCardPrivateJwk?: JWK,        // enables the encrypted-card rail
  webBaseUrl: string,                   // for approvalUrl
  apiBaseUrl: string,                   // for /v1/config
  auth: { provider: "stytch", projectId, environment, cliClientId?, mcpClientId? },
  requestTtlMinutes?: number,           // default 15
  defaultRequester?: string,            // default "Agent"
  railPreference?: RailKind[],
})
```

Returns `{ GET, POST, DELETE, PUT, handler }` where each is `(req: Request) => Promise<Response>` and `handler` dispatches on method. The router matches on the path after the mount prefix; it finds the prefix by locating `/v1/` in the URL path.
