import type { AgentCard, BuyerProfile, BuyerProfileInput, PaymentMethod } from "@agent-commerce/core";
import type { CheckoutView } from "@agent-commerce/server";
import { serverEnv } from "@/lib/env";
import { getAgentCommerceHandlers } from "@/lib/api-server";

/**
 * Calls the Agent Commerce API in process. The chat tools build a `Request` for the same
 * `/api/agent-commerce/v1/...` paths the browser and the CLI use and hand it to the mounted
 * handlers with the user's session JWT. One code path, no HTTP round trip.
 */

export class AgentCommerceToolError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AgentCommerceToolError";
    this.status = status;
    this.code = code;
  }
}

type Method = "GET" | "POST" | "DELETE";

export interface AgentCardRequestView {
  id: string;
  requester: string;
  amount: { value: string; currency: string };
  description: string;
  merchant?: { name: string; url: string; countryCode: string };
  expiresAt: string;
  requestExpiresAt: string;
  status: "pending" | "approved" | "active" | "denied" | "expired" | "failed";
  agentCardId?: string;
  approvalUrl: string;
}

export interface MintCredentialsResult {
  agentCardId: string;
  rail: string;
  provider?: string;
  enforced: boolean;
  card?: { number: string; expirationMonth: string; expirationYear: string; cvc: string };
  token?: string;
  expiresAt?: string;
}

export function apiClient(jwt: string) {
  async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const handlers = await getAgentCommerceHandlers();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    // The router matches on the path after "/v1/", so the origin only needs to parse.
    const res = await handlers.handler(
      new Request(`${serverEnv.apiBaseUrl()}/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    if (!res.ok) {
      const err = (json as { error?: { code?: string; message?: string } } | undefined)?.error;
      throw new AgentCommerceToolError(res.status, err?.code ?? "internal", err?.message ?? `Agent Commerce API returned ${res.status}`);
    }
    return json as T;
  }

  const enc = encodeURIComponent;

  return {
    listPaymentMethods: async () =>
      (await call<{ paymentMethods: PaymentMethod[] }>("GET", "/payment-methods")).paymentMethods,
    listAgentCards: async () => (await call<{ agentCards: AgentCard[] }>("GET", "/agent-cards")).agentCards,
    getAgentCard: (id: string) => call<AgentCard>("GET", `/agent-cards/${enc(id)}`),
    revokeAgentCard: (id: string) => call<void>("DELETE", `/agent-cards/${enc(id)}`),
    mintCredentials: (id: string, input: Record<string, unknown>) =>
      call<MintCredentialsResult>("POST", `/agent-cards/${enc(id)}/credentials`, input),
    createAgentCardRequest: (input: Record<string, unknown>) =>
      call<AgentCardRequestView>("POST", "/agent-card-requests", input),
    getAgentCardRequest: (id: string) => call<AgentCardRequestView>("GET", `/agent-card-requests/${enc(id)}`),
    createCheckout: (input: Record<string, unknown>) => call<CheckoutView>("POST", "/checkouts", input),
    getCheckout: (id: string) => call<CheckoutView>("GET", `/checkouts/${enc(id)}`),
    answerCheckout: (id: string, input: Record<string, unknown>) => call<CheckoutView>("POST", `/checkouts/${enc(id)}/messages`, input),
    cancelCheckout: (id: string) => call<CheckoutView>("POST", `/checkouts/${enc(id)}/cancel`, {}),
    getBuyerProfile: async () =>
      (await call<{ buyerProfile: BuyerProfile | null }>("GET", "/buyer-profile")).buyerProfile,
    createBuyerProfile: (input: BuyerProfileInput) =>
      call<{ id: string }>("POST", "/buyer-profiles", input),
    setCheckoutAgentCard: (id: string, agentCardId: string) =>
      call<CheckoutView>("POST", `/checkouts/${enc(id)}/agent-card`, { agentCardId }),
  };
}

export type AgentCommerceClient = ReturnType<typeof apiClient>;
