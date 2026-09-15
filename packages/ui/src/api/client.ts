import type { AgentCard, BuyerProfileInput, PaymentMethod, RegisterCardInput, RegisterCardResult } from "@goat-wallet/core";
import type {
  AgentCardRequest,
  ApproveAgentCardRequestInput,
  ApproveAgentCardRequestResult,
  CheckoutView,
  CreateAgentCardRequestInput,
  CreateCheckoutInput,
  GoatConfig,
  GoatErrorCode,
  GoatErrorEnvelope,
  Me,
  MintCredentialsInput,
  MintCredentialsResult,
  VerifiedAgentCardRequestResult,
} from "./types.js";

export class GoatApiError extends Error {
  readonly status: number;
  readonly code: GoatErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, envelope: GoatErrorEnvelope["error"]) {
    super(envelope.message);
    this.name = "GoatApiError";
    this.status = status;
    this.code = envelope.code;
    this.details = envelope.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export type GetJwt = () => string | null | undefined | Promise<string | null | undefined>;

export interface GoatApiOptions {
  /** Where the GOAT server is mounted. Default "/api/goat". */
  baseUrl?: string;
  /** Returns the user's JWT. Called on every request so it is always fresh. */
  getJwt: GetJwt;
  /** Override fetch, for tests or custom agents. */
  fetch?: typeof fetch;
}

export type GoatApi = ReturnType<typeof createGoatApi>;

/**
 * Typed functions for every route in docs/API.md.
 * Throws `GoatApiError` with the server's error envelope on any non-2xx.
 */
export function createGoatApi(opts: GoatApiOptions) {
  const baseUrl = (opts.baseUrl ?? "/api/goat").replace(/\/+$/, "");
  const doFetch = opts.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(
    method: "GET" | "POST" | "DELETE" | "PUT",
    path: string,
    body?: unknown,
    { auth = true }: { auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const jwt = await opts.getJwt();
      if (!jwt) throw new GoatApiError(401, { code: "unauthorized", message: "Not signed in." });
      headers.Authorization = `Bearer ${jwt}`;
    }
    const res = await doFetch(`${baseUrl}/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let json: unknown = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    if (!res.ok) {
      const envelope = isEnvelope(json)
        ? json.error
        : { code: res.status === 401 ? "unauthorized" : "internal", message: text || `Request failed with ${res.status}` };
      throw new GoatApiError(res.status, envelope);
    }
    return json as T;
  }

  const enc = encodeURIComponent;

  return {
    baseUrl,

    // Public config and identity
    getConfig: () => request<GoatConfig>("GET", "/config", undefined, { auth: false }),
    me: () => request<Me>("GET", "/me"),

    // Payment methods (saved cards)
    listPaymentMethods: async () =>
      (await request<{ paymentMethods: PaymentMethod[] }>("GET", "/payment-methods")).paymentMethods,
    registerPaymentMethod: (id: string, input: RegisterCardInput) =>
      request<RegisterCardResult>("POST", `/payment-methods/${enc(id)}/register`, input),
    deletePaymentMethod: (id: string) => request<void>("DELETE", `/payment-methods/${enc(id)}`),

    // Agent card requests
    createAgentCardRequest: (input: CreateAgentCardRequestInput) =>
      request<AgentCardRequest>("POST", "/agent-card-requests", input),
    getAgentCardRequest: (id: string) => request<AgentCardRequest>("GET", `/agent-card-requests/${enc(id)}`),
    approveAgentCardRequest: (id: string, input: ApproveAgentCardRequestInput) =>
      request<ApproveAgentCardRequestResult>("POST", `/agent-card-requests/${enc(id)}/approve`, input),
    verifiedAgentCardRequest: (id: string) =>
      request<VerifiedAgentCardRequestResult>("POST", `/agent-card-requests/${enc(id)}/verified`),
    denyAgentCardRequest: (id: string) => request<AgentCardRequest>("POST", `/agent-card-requests/${enc(id)}/deny`),

    // Agent cards (order intents)
    listAgentCards: async () => (await request<{ agentCards: AgentCard[] }>("GET", "/agent-cards")).agentCards,
    getAgentCard: (id: string) => request<AgentCard>("GET", `/agent-cards/${enc(id)}`),
    revokeAgentCard: (id: string) => request<void>("DELETE", `/agent-cards/${enc(id)}`),
    mintCredentials: (id: string, input: MintCredentialsInput = {}) =>
      request<MintCredentialsResult>("POST", `/agent-cards/${enc(id)}/credentials`, input),

    // Checkouts
    createCheckout: (input: CreateCheckoutInput) => request<CheckoutView>("POST", "/checkouts", input),
    getCheckout: (id: string) => request<CheckoutView>("GET", `/checkouts/${enc(id)}`),
    submitCheckoutAction: (id: string, actionId: string, values: Record<string, unknown>) =>
      request<CheckoutView>("POST", `/checkouts/${enc(id)}/actions/${enc(actionId)}`, { values }),
    createBuyerProfile: (input: BuyerProfileInput) => request<{ id: string }>("POST", "/buyer-profiles", input),
  };
}

function isEnvelope(x: unknown): x is GoatErrorEnvelope {
  return (
    typeof x === "object" &&
    x !== null &&
    "error" in x &&
    typeof (x as { error: unknown }).error === "object" &&
    (x as { error: unknown }).error !== null &&
    "code" in ((x as { error: object }).error as object)
  );
}

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof GoatApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}
