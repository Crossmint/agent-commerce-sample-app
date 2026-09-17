/**
 * Shapes the CLI reads from the GOAT HTTP API. They mirror docs/API.md.
 * Crossmint shapes (AgentCard, PaymentMethod, PendingUserAction) come from @goat-wallet/core.
 */
import type { Amount, CheckoutReceipt, CheckoutResult, CheckoutStatus, Merchant, PendingUserAction, RenderedAction } from "@goat-wallet/core";

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
  rail: "agentic-token" | "encrypted-card";
  provider?: "vic" | "agentpay" | "stripe";
  enforced: boolean;
  card?: { number: string; expirationMonth: string; expirationYear: string; cvc: string };
  token?: string;
  expiresAt?: string;
}

export interface CreateCheckoutBody {
  startUrl: string;
  task?: string;
  agentCardId: string;
  maxCost: { amount: string; currency: string };
  buyerProfileId?: string;
  browserProfileId?: string;
  merchantGuidance?: string;
}

/** Body of POST /v1/checkouts/:id/messages. */
export interface CheckoutMessageBody {
  requestId?: string;
  action?: "submit" | "decline" | "alternative";
  values?: Record<string, unknown>;
  text?: string;
}

export interface CheckoutView {
  id: string;
  status: CheckoutStatus;
  agentCardId?: string;
  pendingUserAction?: PendingUserAction;
  rendered?: RenderedAction;
  embedUrl?: string;
  result?: CheckoutResult;
  receipt?: CheckoutReceipt;
  failure?: { reason: string; message?: string };
  spentUsd?: string;
  createdAt?: string;
}

export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}
