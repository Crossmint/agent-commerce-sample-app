import type { AgentCard, BuyerProfile, BuyerProfileInput, PaymentMethod, RegisterCardInput, RegisterCardResult } from "@agent-commerce/core";
import type {
  AgentCardRequest,
  ApproveAgentCardRequestInput,
  ApproveAgentCardRequestResult,
  CheckoutMessageInput,
  CheckoutMessageList,
  CheckoutView,
  CreateAgentCardRequestInput,
  CreateCheckoutInput,
  AgentCommerceConfig,
  AgentCommerceErrorCode,
  AgentCommerceErrorEnvelope,
  Me,
  MintCredentialsInput,
  MintCredentialsResult,
  Reveal,
  VerifiedAgentCardRequestResult,
} from "./types.js";

export class AgentCommerceApiError extends Error {
  readonly status: number;
  readonly code: AgentCommerceErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, envelope: AgentCommerceErrorEnvelope["error"]) {
    super(envelope.message);
    this.name = "AgentCommerceApiError";
    this.status = status;
    this.code = envelope.code;
    this.details = envelope.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export type GetJwt = () => string | null | undefined | Promise<string | null | undefined>;

export interface AgentCommerceApiOptions {
  /** Where the Agent Commerce server is mounted. Default "/api/agent-commerce". */
  baseUrl?: string;
  /** Returns the user's JWT. Called on every request so it is always fresh. */
  getJwt: GetJwt;
  /** Override fetch, for tests or custom agents. */
  fetch?: typeof fetch;
}

export type AgentCommerceApi = ReturnType<typeof createAgentCommerceApi>;

/**
 * Typed functions for every route in docs/API.md.
 * Throws `AgentCommerceApiError` with the server's error envelope on any non-2xx.
 */
export function createAgentCommerceApi(opts: AgentCommerceApiOptions) {
  const baseUrl = (opts.baseUrl ?? "/api/agent-commerce").replace(/\/+$/, "");
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
      if (!jwt) throw new AgentCommerceApiError(401, { code: "unauthorized", message: "Not signed in." });
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
      throw new AgentCommerceApiError(res.status, envelope);
    }
    return json as T;
  }

  const enc = encodeURIComponent;

  return {
    baseUrl,

    // Public config and identity
    getConfig: () => request<AgentCommerceConfig>("GET", "/config", undefined, { auth: false }),
    me: () => request<Me>("GET", "/me"),

    // Payment methods (saved cards)
    listPaymentMethods: async () =>
      (await request<{ paymentMethods: PaymentMethod[] }>("GET", "/payment-methods")).paymentMethods,
    registerPaymentMethod: (id: string, input: Partial<RegisterCardInput>) =>
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
    listReveals: async (options: { limit?: number; agentCardId?: string } = {}) => {
      const q = new URLSearchParams();
      if (options.limit) q.set("limit", String(options.limit));
      if (options.agentCardId) q.set("agentCardId", options.agentCardId);
      const query = q.toString();
      return (await request<{ reveals: Reveal[] }>("GET", `/reveals${query ? `?${query}` : ""}`)).reveals;
    },
    getAgentCard: (id: string) => request<AgentCard>("GET", `/agent-cards/${enc(id)}`),
    revokeAgentCard: (id: string) => request<void>("DELETE", `/agent-cards/${enc(id)}`),
    mintCredentials: (id: string, input: MintCredentialsInput = {}) =>
      request<MintCredentialsResult>("POST", `/agent-cards/${enc(id)}/credentials`, input),

    // Checkouts
    createCheckout: (input: CreateCheckoutInput) => request<CheckoutView>("POST", "/checkouts", input),
    getCheckout: (id: string) => request<CheckoutView>("GET", `/checkouts/${enc(id)}`),
    /** The run's transcript, oldest first: progress, questions, answers, the result. */
    listCheckoutMessages: (id: string, options: { cursor?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (options.cursor) q.set("cursor", options.cursor);
      if (options.limit) q.set("limit", String(options.limit));
      const query = q.toString();
      return request<CheckoutMessageList>("GET", `/checkouts/${enc(id)}/messages${query ? `?${query}` : ""}`);
    },
    /**
     * The run's transcript as server-sent events, from `after` on. The raw
     * Response: `useCheckoutMessages` reads it. Throws like any call when the
     * stream cannot open.
     */
    streamCheckoutMessages: async (id: string, options: { after?: string; signal?: AbortSignal } = {}) => {
      const jwt = await opts.getJwt();
      if (!jwt) throw new AgentCommerceApiError(401, { code: "unauthorized", message: "Not signed in." });
      const q = options.after ? `?after=${encodeURIComponent(options.after)}` : "";
      const res = await doFetch(`${baseUrl}/v1/checkouts/${enc(id)}/messages/stream${q}`, {
        headers: { Accept: "text/event-stream", Authorization: `Bearer ${jwt}` },
        credentials: "same-origin",
        signal: options.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
        throw new AgentCommerceApiError(
          res.status,
          isEnvelope(json) ? json.error : { code: "internal", message: text || `Request failed with ${res.status}` },
        );
      }
      return res;
    },
    answerCheckout: (id: string, input: CheckoutMessageInput) => request<CheckoutView>("POST", `/checkouts/${enc(id)}/messages`, input),
    cancelCheckout: (id: string) => request<CheckoutView>("POST", `/checkouts/${enc(id)}/cancel`, {}),
    createBuyerProfile: (input: BuyerProfileInput) => request<{ id: string }>("POST", "/buyer-profiles", input),
    /** The saved details checkouts start with, or null when there are none. */
    getBuyerProfile: async () => (await request<{ buyerProfile: BuyerProfile | null }>("GET", "/buyer-profile")).buyerProfile,
  };
}

function isEnvelope(x: unknown): x is AgentCommerceErrorEnvelope {
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
  if (err instanceof AgentCommerceApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}
