/**
 * Small fetch client for the Agent Commerce HTTP API (docs/API.md).
 *
 * It holds one user bearer token and forwards it on every call. It never holds
 * Crossmint keys. Method names follow the API routes one to one.
 */
import type {
  AgentCard,
  Amount,
  BuyerProfileInput,
  CheckoutReceipt,
  CheckoutResult,
  CheckoutStatus,
  Merchant,
  PendingUserAction,
  RenderedAction,
} from "@agent-commerce/core";

export type { AgentCard, Amount, Merchant, PendingUserAction, RenderedAction };

// ---------------------------------------------------------------------------
// Response shapes from docs/API.md
// ---------------------------------------------------------------------------

export interface AgentCommerceConfig {
  name: string;
  apiBaseUrl: string;
  webBaseUrl: string;
  crossmintEnvironment: "staging" | "production";
  auth: {
    provider: "stytch" | (string & {});
    projectId: string;
    environment: "test" | "live";
    oauth: {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      cliClientId?: string;
      mcpClientId?: string;
      scopes: string[];
    };
  };
}

export interface AgentCommerceUser {
  userId: string;
  email?: string;
}

export interface PaymentMethodSummary {
  paymentMethodId: string;
  type: string;
  displayName?: string;
  default?: boolean;
  card?: { brand: string; last4: string; expiration?: { month: string; year: string } };
}

export type AgentCardRequestStatus =
  "pending" | "approved" | "active" | "denied" | "expired" | "failed";

export interface AgentCardRequest {
  id: string;
  userId: string;
  requester: string;
  amount: Amount;
  description: string;
  merchant?: { name: string; url: string; countryCode: string };
  expiresAt: string;
  requestExpiresAt: string;
  status: AgentCardRequestStatus;
  agentCardId?: string;
  paymentMethodId?: string;
  failureReason?: string;
  approvalUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentCardRequestInput {
  amount: Amount;
  description: string;
  merchant?: { name: string; url: string; countryCode: string };
  expiresInHours?: number;
  requester?: string;
}

export interface MintCredentialInput {
  amount?: Amount;
  merchant?: Merchant;
  format?: "card";
}

export interface CredentialResult {
  agentCardId: string;
  rail: "agentic-token" | "encrypted-card";
  provider?: "vic" | "agentpay" | "stripe";
  /** `false` means Crossmint does not cap this rail. The limit is advisory. */
  enforced: boolean;
  card?: { number: string; expirationMonth: string; expirationYear: string; cvc: string };
  token?: string;
  expiresAt?: string;
}

export interface CreateCheckoutInput {
  startUrl: string;
  task?: string;
  /** Omit to let the user choose a payment method at the run's payment step. */
  agentCardId?: string;
  maxCost: { amount: string; currency: string };
  buyerProfileId?: string;
  browserProfileId?: string;
  freshBrowser?: boolean;
  merchantGuidance?: string;
}

/** Body of POST /v1/checkouts/:id/messages. */
export interface CheckoutMessageInput {
  requestId?: string;
  action?: "submit" | "decline" | "alternative";
  values?: Record<string, unknown>;
  text?: string;
  messageId?: string;
}

/**
 * The run reached its payment step. The user chooses a payment method at
 * `approvalUrl`, which mints the agent card that pays.
 */
export interface CheckoutPaymentRequest {
  requestId: string;
  status: string;
  approvalUrl: string;
  amount: { value: string; currency: string };
  description: string;
  merchant?: { name: string; url?: string; countryCode?: string };
  agentCardId?: string;
  failureReason?: string;
}

export interface CheckoutView {
  id: string;
  status: CheckoutStatus;
  agentCardId?: string;
  paymentRequest?: CheckoutPaymentRequest;
  pendingUserAction?: PendingUserAction;
  rendered?: RenderedAction;
  embedUrl?: string;
  result?: CheckoutResult;
  receipt?: CheckoutReceipt;
  failure?: { reason: string; message?: string };
  spentUsd?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AgentCommerceApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly url: string;

  constructor(opts: {
    status: number;
    url: string;
    code?: string;
    message?: string;
    details?: unknown;
  }) {
    super(opts.message ?? `Agent Commerce request failed with ${opts.status}`);
    this.name = "AgentCommerceApiError";
    this.status = opts.status;
    this.code = opts.code ?? statusToCode(opts.status);
    this.details = opts.details;
    this.url = opts.url;
  }
}

function statusToCode(status: number): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "no_usable_rail";
  if (status >= 400 && status < 500) return "invalid_request";
  return "internal";
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface AgentCommerceApiOptions {
  /** Agent Commerce API base URL including the mount prefix, e.g. `https://wallet.example.com/api/agent-commerce`. */
  baseUrl: string;
  /** The user's JWT. Optional only for `config()`. */
  bearerToken?: string;
  fetch?: typeof fetch;
}

export class AgentCommerceApi {
  readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AgentCommerceApiOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.bearerToken;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  config(): Promise<AgentCommerceConfig> {
    return this.call("GET", "/v1/config", { auth: false });
  }

  me(): Promise<AgentCommerceUser> {
    return this.call("GET", "/v1/me");
  }

  async listPaymentMethods(): Promise<PaymentMethodSummary[]> {
    const res = await this.call<{ paymentMethods: PaymentMethodSummary[] }>(
      "GET",
      "/v1/payment-methods",
    );
    return res.paymentMethods;
  }

  createAgentCardRequest(input: CreateAgentCardRequestInput): Promise<AgentCardRequest> {
    return this.call("POST", "/v1/agent-card-requests", { body: input });
  }

  getAgentCardRequest(id: string): Promise<AgentCardRequest> {
    return this.call("GET", `/v1/agent-card-requests/${enc(id)}`);
  }

  async listAgentCards(): Promise<AgentCard[]> {
    const res = await this.call<{ agentCards: AgentCard[] }>("GET", "/v1/agent-cards");
    return res.agentCards;
  }

  getAgentCard(id: string): Promise<AgentCard> {
    return this.call("GET", `/v1/agent-cards/${enc(id)}`);
  }

  async revokeAgentCard(id: string): Promise<void> {
    await this.call<void>("DELETE", `/v1/agent-cards/${enc(id)}`);
  }

  mintCredential(id: string, input: MintCredentialInput = {}): Promise<CredentialResult> {
    return this.call("POST", `/v1/agent-cards/${enc(id)}/credentials`, { body: input });
  }

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutView> {
    return this.call("POST", "/v1/checkouts", { body: input });
  }

  getCheckout(id: string): Promise<CheckoutView> {
    return this.call("GET", `/v1/checkouts/${enc(id)}`);
  }

  answerCheckout(id: string, input: CheckoutMessageInput): Promise<CheckoutView> {
    return this.call("POST", `/v1/checkouts/${enc(id)}/messages`, { body: input });
  }

  cancelCheckout(id: string): Promise<CheckoutView> {
    return this.call("POST", `/v1/checkouts/${enc(id)}/cancel`);
  }

  createBuyerProfile(input: BuyerProfileInput): Promise<{ id: string }> {
    return this.call("POST", "/v1/buyer-profiles", { body: input });
  }

  private async call<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    opts: { body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.auth !== false) {
      if (!this.token)
        throw new AgentCommerceApiError({
          status: 401,
          url,
          code: "unauthorized",
          message: "No bearer token.",
        });
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let json: unknown = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    if (!res.ok) {
      const err = (
        json as { error?: { code?: string; message?: string; details?: unknown } } | undefined
      )?.error;
      throw new AgentCommerceApiError({
        status: res.status,
        url,
        code: err?.code,
        message: err?.message ?? (typeof json === "string" ? json : undefined),
        details: err?.details,
      });
    }
    return json as T;
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
