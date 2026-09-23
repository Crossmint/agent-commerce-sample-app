# Agent Commerce HTTP API contract

This is the contract between `@agent-commerce/server` (implements it), `@agent-commerce/ui` (browser caller), `agent-commerce` CLI and `@agent-commerce/mcp` (agent callers). All four must match this file. Change the file first, then the code.

Base path: the server is mounted at a prefix, in the reference app `/api/agent-commerce`. All paths below are relative to that prefix. Version segment `v1` is part of the path.

## Auth

Every route except `GET /v1/config` requires `Authorization: Bearer <user jwt>`. The JWT is a Stytch session JWT (browser) or a Stytch Connected Apps access token (CLI, MCP). The server calls `UserAuth.verify`. On failure: `401 { "error": { "code": "unauthorized", "message": "..." } }`.

Session JWTs are forwarded as is to Crossmint on every payment-method and order-intent call. An OAuth access token from an agent is first exchanged for a Stytch session (first-party client, full access) and the resulting session JWT is what reaches Crossmint. The server stores that session keyed by a hash of the access token. Agent Checkouts use the server key plus `x-crossmint-user-id: <userId>`.

## Errors

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

Codes: `unauthorized`, `forbidden`, `not_found`, `invalid_request`, `expired`, `no_usable_rail`, `verification_required`, `cvc_recollection_required`, `merchant_required`, `crossmint_error`, `internal`. `crossmint_error` carries `details.status` and `details.body` from Crossmint.

## Public config

`GET /v1/config` (no auth). Lets a CLI log in knowing only the API URL.

```json
{
  "name": "Agent Commerce Sample App",
  "apiBaseUrl": "https://wallet.example.com/api/agent-commerce",
  "webBaseUrl": "https://wallet.example.com",
  "crossmintEnvironment": "staging" | "production",
  "auth": {
    "provider": "stytch",
    "projectId": "project-test-...",
    "environment": "test" | "live",
    "authorizationServer": "https://test.stytch.com/v1/public/<projectId>",
    "oauth": {
      "authorizationEndpoint": "https://wallet.example.com/oauth/authorize",
      "tokenEndpoint": "https://test.stytch.com/v1/public/<projectId>/oauth2/token",
      "cliClientId": "connected-app-...",
      "mcpClientId": "connected-app-...",
      "scopes": ["openid", "email", "profile", "offline_access", "full_access"]
    }
  }
}
```

## Whoami

`GET /v1/me` → `{ "userId": "user-test-...", "email": "a@b.c" }`

## Payment methods (saved cards)

`GET /v1/payment-methods` → `{ "paymentMethods": PaymentMethod[] }` where `PaymentMethod` is the Crossmint shape from `@agent-commerce/core` (`paymentMethodId`, `type`, `displayName`, `card.brand`, `card.last4`, `card.expiration`). Never a full number.

`POST /v1/payment-methods/:id/register` body `{ "email"?: string, "countryCode"?: string, "languageCode"?: string }` → `RegisterCardResult` (`{ paymentMethodId, rails: [{ rail, provider, status }] }`). Idempotent. `countryCode` defaults to `US`. When `email` is absent the server uses the token's email, then `UserAuth.lookupEmail`, then fails with `400 invalid_request`.

`DELETE /v1/payment-methods/:id` → `204`.

## Agent card requests

The agent's ask, stored by Agent Commerce until the user answers.

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
→ `{ "request": AgentCardRequest, "agentCard": AgentCard, "needsVerification": boolean, "needsCvcRecollection": boolean }`. `AgentCard` is the Crossmint `OrderIntent` shape. `needsCvcRecollection` says the card cannot pay until the user types the security code again, so the approval screen asks for the digits. It is false when a live rail still pays and only the unused fallback is stale.
Answers a `pending` request, and a second time while it is `approved`: the card exists but no agent can spend from it until verification lands, so the user may still swap cards or retry. The earlier order intent is revoked first, best effort. Once the request is `active`, `denied`, `expired` or `failed`, approve returns `409`.

`POST /v1/agent-card-requests/:id/verified` (browser) → re-reads the order intent. If a rail is active, `status: "active"`. → `{ "request": AgentCardRequest, "agentCard": AgentCard }`.

`POST /v1/agent-card-requests/:id/deny` → `AgentCardRequest` with `status: "denied"`. Allowed while `pending` or `approved`; an order intent made on the way is revoked with it.

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
  "rail": "agentic-token" | "encrypted-card",
  "provider"?: "vic" | "agentpay",
  "enforced": true | false,
  "card"?: { "number": "…", "expirationMonth": "12", "expirationYear": "2030", "cvc": "123" },
  "token"?: "…",            // only for the network-token format
  "expiresAt"?: "…"
}
```

`enforced: false` means Crossmint does not cap this rail; the limit is advisory. Rail order is fixed: `agentic-token` (Visa Intelligent Commerce or Mastercard Agent Pay) first, `encrypted-card` second. The Stripe `spt` rail is never used and is stripped from every agent card response. If the only card rail still needs the user's verification: `409 verification_required`. If it needs the saved card's security code typed again: `409 cvc_recollection_required`, with `details.paymentMethodId` — the wallet's field is keyed by the saved card, not by the budget. Both signals Crossmint gives are folded into that one code: a rail that reads `pending_cvc_recollection` before the mint, and the `409 ORDER_INTENT_CVC_RECOLLECTION_REQUIRED` it returns when the vault lapses during one. If no rail is active: `409 no_usable_rail`. If the agent card has no merchant and the body names none: `400 merchant_required`. Card networks issue credentials per merchant, so agents pass the store they are about to pay.

## Checkouts

Wraps [Crossmint Agent Checkouts](https://docs.crossmint.com/api-reference/agent-checkouts/create-agent-checkout): a run that drives the store's checkout in a real browser. The store's card form never reaches the caller: Agent Commerce answers it from a credential it mints. `agentCardId` is optional, and which agent card pays depends on whether you pass one — see `paymentRequest` below.

`POST /v1/checkouts` (agent) body:

```json
{ "startUrl": "https://shop.example/p/1", "task"?: "medium, black", "agentCardId"?: "…", "maxCost": { "amount": "100.00", "currency": "USD" }, "buyerProfileId"?: "…", "browserProfileId"?: "…", "freshBrowser"?: false, "merchantGuidance"?: "…" }
```

`url` and `request` are accepted as older names for `startUrl` and `task`. → `201 CheckoutView`.

Sessions are sticky: the server attaches the user's browser profile to every run, so a store they signed into once stays signed in. Callers need pass nothing. `browserProfileId` names a different profile; `freshBrowser: true` starts signed out, which is the way past a login that has gone stale. If the profile cannot be resolved the run still goes ahead, in a fresh browser — the convenience never fails a purchase.

```ts
interface CheckoutView {
  id: string;                            // Crossmint runId
  status: "queued" | "running" | "awaiting_input" | "succeeded" | "blocked" | "failed" | "cancelled";
  agentCardId?: string;
  paymentRequest?: {                     // the run's payment step; the user picks a payment method
    requestId: string;                   // an agent card request: approve, deny and poll it as usual
    status: "pending" | "approved" | "active" | "denied" | "expired" | "failed";
    approvalUrl: string;                 // show this to the user
    amount: { value: string; currency: string };  // the run's maxCost
    description: string;
    merchant?: { name: string; url?: string; countryCode?: string };
    agentCardId?: string;                // set once a card exists but cannot pay yet
    failureReason?: string;
  };
  pendingUserAction?: {                  // the open input request; never a payment one
    id: string;                          // requestId to answer
    messageId?: string;
    question: string;
    expiresAt?: string;                  // answer before this or the run fails with input_expired
    responseSchema: JsonSchema;
    uiSchema?: object;
  };
  rendered?: RenderedAction;             // from renderPendingAction, for UIs
  embedUrl?: string;                     // absolute URL for a view-only iframe of the agent's browser
  result?: { outcome; summary; code?; purchase? }; // on succeeded, blocked, cancelled
  receipt?: { total: { amount; currency }; merchantOrderId? }; // on succeeded, when captured
  failure?: { reason: string; message?: string }; // failed: Crossmint reason; blocked: the code; cancelled
  spentUsd?: string;
  createdAt?: string;
}
```

`GET /v1/checkouts/:id` → `CheckoutView`. Poll it about every 1.5s; there are no webhooks.

While polling, when the open input request asks for **card fields** the server never passes it on. What it does depends on the checkout:

- **With an `agentCardId`** (passed to `POST /v1/checkouts`, or minted earlier in this run): the server mints a credential from that agent card and answers the request itself before returning. The view reports `running` while that is in flight.
- **Without one**: the server creates an agent card request scoped to the run — `maxCost` for the amount, the start URL's host for the merchant lock — and returns it as `paymentRequest`. The status stays `awaiting_input`. The user answers it through the ordinary `POST /v1/agent-card-requests/:id/approve`, or at `approvalUrl`; once the card is active the next poll mints from it, answers the store, and the run carries on. One request per run: it is reused on every poll, and a denial is returned as it is rather than replaced.

`POST /v1/checkouts/:id/messages` body, one of:

```json
{ "requestId": "…", "values": { "fullName": "Ada Lovelace" } }          // submit the form (action defaults to "submit")
{ "requestId": "…", "action": "decline" }                               // refuse the request
{ "requestId": "…", "action": "alternative", "text": "cheapest shipping" }
{ "text": "prefer the blue one if the black is out" }                   // a note to the agent, no request
```

Optional `messageId` (≤200 chars) makes a retry idempotent. → `CheckoutView`. If the `requestId` names a payment request: `409 payment_handled_by_server`.

`GET /v1/checkouts/:id/messages?cursor&limit` → Crossmint's message list (progress, activity, input requests, result, and what was sent) as is.

`POST /v1/checkouts/:id/cancel` → `CheckoutView`. The run reaches `cancelled` on a later poll.

`POST /v1/checkouts/:id/actions/:actionId` body `{ "values": {...} }` → `CheckoutView`. Older route, same as a `submit` message with `requestId = actionId`.

`POST /v1/buyer-profiles` body `BuyerProfileInput` (core) → `{ "id": "…" }`.

`GET /v1/browser-profile` → `{ "browserProfile": { "id": "…" } | null }`. The user's saved merchant logins, as metadata: Crossmint returns no cookies or tokens, so there is nothing else to show. Null until a checkout has made the profile; reading does not create one.

`DELETE /v1/browser-profile` → `204`. Sign out everywhere. Irreversible: it erases the stored browser state, not just the record. The next checkout starts signed out and saves whatever the user logs into then.

## Server config object

```ts
createAgentCommerceHandlers({
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
