/**
 * Shapes the CLI reads from the GOAT HTTP API. They mirror docs/API.md.
 * Crossmint shapes (AgentCard, PaymentMethod, PendingUserAction) come from @goat-wallet/core.
 */
import type { Amount, Merchant, PendingUserAction, RenderedAction } from "@goat-wallet/core";

export interface PublicConfig {
  name: string;
  apiBaseUrl: string;
  webBaseUrl: string;
  crossmintEnvironment: "staging" | "production";
  auth: {
    provider: string;
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

export interface Me {
  userId: string;
  email?: string;
}

export type AgentCardRequestStatus =
  "pending" | "approved" | "active" | "denied" | "expired" | "failed";

export interface AgentCardRequest {
  id: string;
  userId: string;
  requester: string;
  amount: Amount;
  description: string;
  merchant?: Merchant;
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

export interface CreateAgentCardRequestBody {
  amount: Amount;
  description: string;
  merchant?: Merchant;
  expiresInHours?: number;
  requester?: string;
}

export interface MintCredentialBody {
  amount?: Amount;
  merchant?: Merchant;
  format?: "card";
}

export interface CredentialResponse {
  agentCardId: string;
  rail: "agentic-token" | "spt" | "encrypted-card";
  provider?: "vic" | "agentpay" | "stripe";
  enforced: boolean;
  card?: { number: string; expirationMonth: string; expirationYear: string; cvc: string };
  token?: string;
  expiresAt?: string;
}

export interface CreateCheckoutBody {
  url: string;
  request?: string;
  agentCardId: string;
  maxCost: { amount: string; currency: string };
  buyerProfileId?: string;
}

export interface CheckoutView {
  id: string;
  status: string;
  agentCardId?: string;
  pendingUserAction?: PendingUserAction;
  rendered?: RenderedAction;
  embedUrl?: string;
  receipt?: Record<string, unknown>;
  failure?: { reason: string; message?: string };
}

export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}
