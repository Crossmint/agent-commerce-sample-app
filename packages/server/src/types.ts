import type { UserAuth } from "@goat-wallet/auth";
import type {
  Amount,
  CrossmintEnvironment,
  EncryptedCardKeyPair,
  Merchant,
  RailKind,
} from "@goat-wallet/core";

// ---------------------------------------------------------------------------
// Agent card requests
// ---------------------------------------------------------------------------

export type AgentCardRequestStatus =
  "pending" | "approved" | "active" | "denied" | "expired" | "failed";

/** The agent's ask. GOAT stores it until the user answers. See docs/API.md. */
export interface AgentCardRequest {
  /** "acr_" + 21 url-safe chars. */
  id: string;
  userId: string;
  /** "Claude Code", "ChatGPT", app name. */
  requester: string;
  amount: Amount;
  description: string;
  merchant?: Merchant;
  /** The agent card's expiry, ISO. */
  expiresAt: string;
  /** How long the user has to answer, ISO. */
  requestExpiresAt: string;
  status: AgentCardRequestStatus;
  /** Crossmint orderIntentId once created. */
  agentCardId?: string;
  paymentMethodId?: string;
  failureReason?: string;
  /** `${webBaseUrl}/approve/${id}` */
  approvalUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** What the handler gives the store. The store sets `createdAt` and `updatedAt`. */
export type NewAgentCardRequest = Omit<AgentCardRequest, "createdAt" | "updatedAt">;

/** Fields a handler may change after creation. */
export type AgentCardRequestPatch = Partial<
  Pick<AgentCardRequest, "status" | "agentCardId" | "paymentMethodId" | "failureReason">
>;

/**
 * The one table GOAT owns. Implement it for your database, or use
 * `memoryRequestStore()` and `@goat-wallet/server/drizzle`.
 */
export interface RequestStore {
  create(req: NewAgentCardRequest): Promise<AgentCardRequest>;
  get(id: string): Promise<AgentCardRequest | null>;
  /** Apply the patch and set `updatedAt`. Throws when the id is unknown. */
  update(id: string, patch: AgentCardRequestPatch): Promise<AgentCardRequest>;
  /** Optional. Newest first. */
  listByUser?(userId: string): Promise<AgentCardRequest[]>;
}

// ---------------------------------------------------------------------------
// Checkouts
// ---------------------------------------------------------------------------

export interface CheckoutLink {
  checkoutId: string;
  userId: string;
  agentCardId: string;
  createdAt: string;
}

/**
 * Maps a Crossmint checkout to the agent card that pays for it.
 * The server needs this to answer payment actions itself.
 */
export interface CheckoutStore {
  linkCheckout(checkoutId: string, userId: string, agentCardId: string): Promise<void>;
  getCheckout(checkoutId: string): Promise<CheckoutLink | null>;
}

// ---------------------------------------------------------------------------
// Agent sessions
// ---------------------------------------------------------------------------

/**
 * A Stytch session obtained by exchanging an agent's OAuth access token.
 * Keyed by a hash of the access token, never the token itself.
 */
export interface AgentSession {
  accessTokenHash: string;
  userId: string;
  /** Long-lived opaque Stytch session token. Treat as a secret. */
  sessionToken: string;
  /** Current short-lived session JWT, forwarded to Crossmint. */
  jwt: string;
  jwtExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStore {
  getSession(accessTokenHash: string): Promise<AgentSession | null>;
  putSession(session: AgentSession): Promise<void>;
}

// ---------------------------------------------------------------------------
// Server config
// ---------------------------------------------------------------------------

export type PrivateJwk = EncryptedCardKeyPair["privateJwk"];

export interface GoatCrossmintConfig {
  /** Client-side key (`ck_...`). Used with the user JWT. */
  clientApiKey: string;
  /** Server-side key (`sk_...`). Used for Agent Checkouts with `x-crossmint-user-id`. */
  serverApiKey?: string;
  environment: CrossmintEnvironment;
  /** Override the Crossmint base URL, e.g. for a proxy. */
  baseUrl?: string;
  /** Override the Agent Checkouts base URL. */
  checkoutsBaseUrl?: string;
  /** Custom fetch. Tests inject a fake here. */
  fetch?: typeof fetch;
  /** `Origin` header for client-key calls. Defaults to `webBaseUrl`. Whitelist it in the Crossmint console. */
  origin?: string;
}

export interface GoatAuthConfig {
  provider: "stytch";
  projectId: string;
  environment: "test" | "live";
  cliClientId?: string;
  mcpClientId?: string;
  /** Custom Stytch domain, if any. Defaults to Stytch's public project base. */
  projectDomain?: string;
  /** @deprecated Use `projectDomain`. */
  customDomain?: string;
  /** The hosted consent page. Default `${webBaseUrl}/oauth/authorize`. */
  authorizationUrl?: string;
}

export interface GoatServerConfig {
  crossmint: GoatCrossmintConfig;
  userAuth: UserAuth;
  /**
   * Request store. Add the `CheckoutStore` methods to persist checkout links and the
   * `SessionStore` methods to persist exchanged agent sessions. Both fall back to memory.
   */
  store: RequestStore & Partial<CheckoutStore> & Partial<SessionStore>;
  /** Enables the encrypted-card rail. */
  encryptedCardPrivateJwk?: PrivateJwk;
  /** For `approvalUrl`. No trailing slash. */
  webBaseUrl: string;
  /** For `GET /v1/config`. No trailing slash. */
  apiBaseUrl: string;
  auth: GoatAuthConfig;
  /** Default 15. */
  requestTtlMinutes?: number;
  /** Default "Agent". */
  defaultRequester?: string;
  railPreference?: RailKind[];
  /** Shown in `GET /v1/config`. Default "GOAT". */
  name?: string;
}

// ---------------------------------------------------------------------------
// Public config and responses
// ---------------------------------------------------------------------------

export interface PublicConfig {
  name: string;
  apiBaseUrl: string;
  webBaseUrl: string;
  crossmintEnvironment: CrossmintEnvironment;
  auth: {
    provider: "stytch";
    projectId: string;
    environment: "test" | "live";
    /** The OAuth authorization server base. MCP hosts discover metadata under it. */
    authorizationServer: string;
    oauth: {
      authorizationEndpoint?: string;
      tokenEndpoint: string;
      cliClientId?: string;
      mcpClientId?: string;
      scopes: string[];
    };
  };
}

export interface CredentialResponse {
  agentCardId: string;
  rail: "agentic-token" | "encrypted-card";
  provider?: "vic" | "agentpay";
  /** False when Crossmint does not cap this rail. The limit is then advisory. */
  enforced: boolean;
  card?: { number: string; expirationMonth: string; expirationYear: string; cvc: string };
  /** Network token, when the caller asked for the network-token format. */
  token?: string;
  expiresAt?: string;
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}
