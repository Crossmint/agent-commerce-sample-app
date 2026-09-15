/**
 * Shapes the GOAT HTTP API returns. They follow docs/API.md line by line.
 * Crossmint shapes come from @goat-wallet/core.
 */
import type {
  AgentCard,
  Amount,
  BuyerProfileInput,
  CrossmintEnvironment,
  Merchant,
  PaymentMethod,
  PendingUserAction,
  RailKind,
  RegisterCardInput,
  RegisterCardResult,
  RenderedAction,
} from "@goat-wallet/core";

export interface GoatErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export type GoatErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "expired"
  | "no_usable_rail"
  | "crossmint_error"
  | "internal"
  | (string & {});

export interface GoatConfig {
  name: string;
  apiBaseUrl: string;
  webBaseUrl: string;
  crossmintEnvironment: CrossmintEnvironment;
  auth: {
    provider: "stytch" | (string & {});
    projectId: string;
    environment: "test" | "live";
    oauth?: {
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

export type AgentCardRequestStatus = "pending" | "approved" | "active" | "denied" | "expired" | "failed";

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

export interface CreateAgentCardRequestInput {
  amount: Amount;
  description: string;
  merchant?: Merchant;
  expiresInHours?: number;
  requester?: string;
}

export interface ApproveAgentCardRequestInput {
  paymentMethodId: string;
  email?: string;
  countryCode?: string;
}

export interface ApproveAgentCardRequestResult {
  request: AgentCardRequest;
  agentCard: AgentCard;
  needsVerification: boolean;
}

export interface VerifiedAgentCardRequestResult {
  request: AgentCardRequest;
  agentCard: AgentCard;
}

export interface MintCredentialsInput {
  amount?: Amount;
  merchant?: Merchant;
  format?: "card";
}

export interface MintCredentialsResult {
  agentCardId: string;
  rail: RailKind;
  provider?: "vic" | "agentpay" | "stripe";
  enforced: boolean;
  card?: { number: string; expirationMonth: string; expirationYear: string; cvc: string };
  token?: string;
  expiresAt?: string;
}

export interface CreateCheckoutInput {
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

export type { PaymentMethod, AgentCard, RegisterCardInput, RegisterCardResult, BuyerProfileInput };
