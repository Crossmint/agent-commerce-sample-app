/**
 * Shapes the Agent Commerce HTTP API returns. They follow docs/API.md line by line.
 * Crossmint shapes come from @agent-commerce/core.
 */
import type {
  AgentCard,
  Amount,
  BuyerProfileInput,
  CheckoutReceipt,
  CheckoutResult,
  CheckoutStatus,
  CrossmintEnvironment,
  Merchant,
  PaymentMethod,
  PendingUserAction,
  RailKind,
  RegisterCardInput,
  RegisterCardResult,
  RenderedAction,
} from "@agent-commerce/core";

export interface AgentCommerceErrorEnvelope {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export type AgentCommerceErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "expired"
  | "no_usable_rail"
  | "crossmint_error"
  | "internal"
  | (string & {});

/**
 * One credential an agent minted from an agent card: a line in Transactions.
 * What was asked for, never what came back — the server does not store the
 * card number, the token or the cryptogram, so none of it is here.
 */
export interface Reveal {
  id: string;
  userId: string;
  agentCardId: string;
  /** The saved card the budget draws on. */
  paymentMethodId?: string;
  description?: string;
  amount: Amount;
  merchant?: Merchant;
  rail: string;
  provider?: string;
  /** False when the rail cannot hold the agent to the amount. */
  enforced?: boolean;
  requester?: string;
  createdAt: string;
}

export interface AgentCommerceConfig {
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
  /** The vault's copy of the card's security code lapsed. The user types it again. */
  needsCvcRecollection?: boolean;
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
  startUrl: string;
  task?: string;
  agentCardId: string;
  maxCost: { amount: string; currency: string };
  buyerProfileId?: string;
  /** Overrides the user's own profile, which the server otherwise attaches. */
  browserProfileId?: string;
  /** Start signed out, ignoring the user's saved merchant logins. */
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
 * The run reached its payment step and nothing pays for it yet. The user
 * picks one of their saved payment methods on this request, which mints the
 * agent card the server then pays with.
 */
export interface CheckoutPaymentRequest {
  requestId: string;
  status: AgentCardRequestStatus;
  approvalUrl: string;
  amount: Amount;
  description: string;
  merchant?: Merchant;
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

export type { PaymentMethod, AgentCard, RegisterCardInput, RegisterCardResult, BuyerProfileInput };
