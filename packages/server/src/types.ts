import type { UserAuth } from "@agent-commerce/auth";
import type {
  Amount,
  BuyerProfile,
  CrossmintEnvironment,
  EncryptedCardKeyPair,
  Merchant,
  RailKind,
} from "@agent-commerce/core";

// ---------------------------------------------------------------------------
// Agent card requests
// ---------------------------------------------------------------------------

export type AgentCardRequestStatus =
  "pending" | "approved" | "active" | "denied" | "expired" | "failed";

/** The agent's ask. Agent Commerce stores it until the user answers. See docs/API.md. */
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
 * The one table Agent Commerce owns. Implement it for your database, or use
 * `memoryRequestStore()` and `@agent-commerce/server/drizzle`.
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
  /**
   * The agent card that pays. Absent until there is one: a checkout may
   * start without any, and get its card at the payment step.
   */
  agentCardId?: string;
  /** The agent card request raised at the payment step, while the user chooses a payment method. */
  agentCardRequestId?: string;
  /** What the purchase is, in the agent's few words: the agent card's purpose at the payment step. */
  purpose?: string;
  /**
   * The payment request the server last answered, and the order intent it
   * answered with. Kept on the row, not in one instance's memory: every
   * instance must see it, so none answers the same request twice, and a new
   * request after an answer means that order intent did not work.
   */
  answeredRequestId?: string;
  answeredOrderIntentId?: string;
  createdAt: string;
}

/** What `linkCheckout` may set. Fields left out keep whatever the row holds. */
export interface CheckoutLinkPatch {
  agentCardId?: string;
  agentCardRequestId?: string;
  purpose?: string;
  answeredRequestId?: string;
  answeredOrderIntentId?: string;
}

/**
 * Maps a Crossmint checkout to the agent card that pays for it, and to the
 * request the user answers when the run asks for a payment method. The
 * server needs both to answer payment actions itself.
 */
export interface CheckoutStore {
  linkCheckout(checkoutId: string, userId: string, patch?: CheckoutLinkPatch): Promise<void>;
  getCheckout(checkoutId: string): Promise<CheckoutLink | null>;
}

// ---------------------------------------------------------------------------
// Reveals
// ---------------------------------------------------------------------------

/**
 * One credential minted from an agent card — a "reveal". This is the moment a
 * budget turns into something spendable, so it is the line the user sees in
 * their transactions.
 *
 * It records what was asked for, not what came back: no card number, no
 * network token, no cryptogram ever reaches this row.
 */
export interface Reveal {
  id: string;
  userId: string;
  agentCardId: string;
  /** The saved card the budget draws on, copied so a line can show its artwork. */
  paymentMethodId?: string;
  /** What the agent card is for, copied at mint time so the line reads on its own. */
  description?: string;
  amount: Amount;
  merchant?: Merchant;
  /** The rail the credential came from. */
  rail: string;
  provider?: string;
  /** False when the rail cannot hold the agent to the amount. */
  enforced?: boolean;
  /** Who asked. "Agent" when the caller did not say. */
  requester?: string;
  createdAt: string;
}

export type NewReveal = Omit<Reveal, "id" | "createdAt">;

export interface ListRevealsOptions {
  /** Default 100. */
  limit?: number;
  /** Only this budget's reveals. */
  agentCardId?: string;
}

/**
 * Optional. A store without it still mints credentials — the server keeps the
 * reveals in memory instead and the list empties on restart.
 */
export interface RevealStore {
  recordReveal(reveal: NewReveal): Promise<Reveal>;
  /** Newest first. */
  listReveals(userId: string, options?: ListRevealsOptions): Promise<Reveal[]>;
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
// Buyer profiles
// ---------------------------------------------------------------------------

/**
 * The user's saved buyer details (name, contact, shipping), one per user, with
 * the id of the Crossmint profile a checkout names. Crossmint holds the
 * profile; this is where the server looks it up, so every instance finds the
 * details the user saved once, without listing Crossmint's profiles.
 */
export interface BuyerProfileStore {
  getBuyerProfile(userId: string): Promise<BuyerProfile | null>;
  /** Replaces what the user had saved. */
  putBuyerProfile(userId: string, profile: BuyerProfile): Promise<void>;
  deleteBuyerProfile(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Server config
// ---------------------------------------------------------------------------

export type PrivateJwk = EncryptedCardKeyPair["privateJwk"];

export interface AgentCommerceCrossmintConfig {
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

export interface AgentCommerceAuthConfig {
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

export interface AgentCommerceServerConfig {
  crossmint: AgentCommerceCrossmintConfig;
  userAuth: UserAuth;
  /**
   * Request store. Add the `CheckoutStore` methods to persist checkout links and the
   * `SessionStore` methods to persist exchanged agent sessions, and the
   * `BuyerProfileStore` methods to keep saved buyer details. Each falls back to memory.
   */
  store: RequestStore &
    Partial<CheckoutStore> &
    Partial<SessionStore> &
    Partial<RevealStore> &
    Partial<BuyerProfileStore>;
  /** Enables the encrypted-card rail. */
  encryptedCardPrivateJwk?: PrivateJwk;
  /** For `approvalUrl`. No trailing slash. */
  webBaseUrl: string;
  /** For `GET /v1/config`. No trailing slash. */
  apiBaseUrl: string;
  auth: AgentCommerceAuthConfig;
  /** Default 15. */
  requestTtlMinutes?: number;
  /** Default "Agent". */
  defaultRequester?: string;
  railPreference?: RailKind[];
  /** Shown in `GET /v1/config`. Default "Agent Commerce". */
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
