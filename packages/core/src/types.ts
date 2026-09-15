/**
 * Types that mirror the Crossmint Agents APIs.
 *
 * Naming rule: these types use Crossmint's own names (order intent, payment method)
 * so they can be checked against the Crossmint docs line by line. Everything above
 * this package calls an order intent an "agent card".
 */

export type CrossmintEnvironment = "staging" | "production";

/** Decimal string amount, e.g. "25.00", with a 3-letter currency code. */
export interface Amount {
  value: string;
  currency: string;
}

export interface Merchant {
  name: string;
  url: string;
  countryCode: string;
  categoryCode?: string;
  acquirerBin?: string;
}

// ---------------------------------------------------------------------------
// Payment methods (saved cards)
// ---------------------------------------------------------------------------

export interface CardDetails {
  brand: string;
  last4: string;
  bin?: string;
  fundingType?: string;
  country?: string;
  expiration?: { month: string; year: string };
  billing?: {
    name?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      stateOrRegion?: string;
      postalCode?: string;
      country?: string;
    };
  };
}

export interface PaymentMethod {
  paymentMethodId: string;
  type: "card" | (string & {});
  displayName?: string;
  default?: boolean;
  createdAt?: string;
  updatedAt?: string;
  card?: CardDetails;
}

export interface PaymentMethodList {
  paymentMethods: PaymentMethod[];
  nextCursor?: string;
}

export type RegistrationRailStatus = "enabled" | "pending" | "error";

export interface RegistrationRail {
  rail: "agentic-token" | (string & {});
  provider?: AgenticTokenProvider | (string & {});
  status: RegistrationRailStatus;
  error?: { code: string; message?: string };
}

export interface RegisterCardInput {
  email: string;
  countryCode: string;
  languageCode?: string;
}

export interface RegisterCardResult {
  paymentMethodId: string;
  rails: RegistrationRail[];
}

// ---------------------------------------------------------------------------
// Order intents (agent cards)
// ---------------------------------------------------------------------------

export type OrderIntentStatus = "active" | "cancelled" | "expired";

export type AgenticTokenProvider = "vic" | "agentpay";

export type RailStatus = "active" | "pending_verification" | "error" | (string & {});

export interface OrderIntentAgenticTokenRail {
  rail: "agentic-token";
  provider: AgenticTokenProvider;
  status: RailStatus;
  credentialFormats?: Array<"card" | "network-token">;
  error?: { code: string; message?: string };
}

export interface OrderIntentEncryptedCardRail {
  rail: "encrypted-card";
  status: RailStatus;
  credentialFormats?: Array<"card">;
}

export interface OrderIntentSptRail {
  rail: "spt";
  provider: "stripe";
  status: RailStatus;
  credentialFormats?: Array<"identifier">;
}

export type OrderIntentRail =
  | OrderIntentAgenticTokenRail
  | OrderIntentEncryptedCardRail
  | OrderIntentSptRail;

export type RailKind = OrderIntentRail["rail"];

export interface OrderIntentAmount {
  currency: string;
  total: string;
  available: string;
  reserved: string;
  spent: string;
}

export interface VerificationConfig {
  environment: "production" | "test";
  publicApiKey: string;
  allowanceId: string;
}

export interface OrderIntent {
  orderIntentId: string;
  paymentMethodId: string;
  description: string;
  status: OrderIntentStatus;
  expiresAt: string;
  amount: OrderIntentAmount;
  rails: OrderIntentRail[];
  merchant?: Merchant;
  verificationConfig?: VerificationConfig;
  createdAt?: string;
}

/** GOAT's user-facing name for an order intent. */
export type AgentCard = OrderIntent;

export interface CreateOrderIntentInput {
  paymentMethodId: string;
  amount: Amount;
  description: string;
  /** ISO 8601 with timezone. Required by Crossmint. */
  expiresAt: string;
  merchant?: Merchant;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export interface CardCredentialValue {
  number: string;
  expirationMonth: string;
  expirationYear: string;
  cvc: string;
}

export interface NetworkTokenCredentialValue {
  paymentToken: string;
  cryptogram: string;
  eci: string;
  expirationMonth: string;
  expirationYear: string;
}

export interface MintAgenticTokenCredentialInput {
  rail: "agentic-token";
  provider: AgenticTokenProvider;
  amount: Amount;
  credential: { format: "card" | "network-token" };
  /** Required only when the order intent was created without a merchant. */
  merchant?: Merchant;
}

export interface MintSptCredentialInput {
  rail: "spt";
  provider: "stripe";
  amount: Amount;
  credential: { format: "identifier"; payload: { networkBusinessProfile: string } };
  merchant?: Merchant;
}

/** RSA public key as a JWK with only these three fields, as Crossmint requires. */
export interface RsaPublicJwk {
  kty: "RSA";
  n: string;
  e: string;
}

export interface MintEncryptedCardCredentialInput {
  rail: "encrypted-card";
  credential: { format: "card"; publicKey: RsaPublicJwk };
}

export type MintCredentialInput =
  | MintAgenticTokenCredentialInput
  | MintSptCredentialInput
  | MintEncryptedCardCredentialInput;

export interface AgenticTokenCredential {
  id: string;
  rail: "agentic-token";
  provider: AgenticTokenProvider;
  amount: Amount;
  credential:
    | { format: "card"; value: CardCredentialValue }
    | { format: "network-token"; value: NetworkTokenCredentialValue };
  expiresAt: string;
}

export interface SptCredential {
  id: string;
  rail: "spt";
  provider: "stripe";
  amount: Amount;
  credential: { format: "identifier"; value: string };
  expiresAt: string;
}

export interface EncryptedCardCredential {
  rail: "encrypted-card";
  /** JWE compact serialization, encrypted to the public key you supplied. */
  credential: { format: "card"; value: string };
}

export type Credential = AgenticTokenCredential | SptCredential | EncryptedCardCredential;

// ---------------------------------------------------------------------------
// Agent checkouts
// ---------------------------------------------------------------------------

export type CheckoutStatus =
  | "pending"
  | "running"
  | "awaiting_user_action"
  | "succeeded"
  | "failed"
  | "cancelled"
  | (string & {});

export type CheckoutFailureReason =
  | "max_cost_exceeded"
  | "user_cancelled"
  | "user_action_expired"
  | "automation_failed"
  | "automation_timeout"
  | "llm_spend_exceeded"
  | (string & {});

export interface CheckoutTarget {
  kind: "direct_url";
  url: string;
  /** Natural-language instruction for the agent, e.g. "buy the medium in black". */
  request?: string;
}

export interface CheckoutConstraints {
  maxCost: { amount: string; currency: string };
}

export interface CreateCheckoutInput {
  target: CheckoutTarget;
  constraints: CheckoutConstraints;
  buyerProfileId?: string;
}

/** A JSON Schema object. Kept loose on purpose; GOAT walks `.properties`. */
export interface JsonSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  items?: JsonSchema;
  format?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
}

export interface PendingUserAction {
  id: string;
  /** Crossmint may call this `type` or `kind`; GOAT reads both. */
  type?: string;
  kind?: string;
  title?: string;
  description?: string;
  responseSchema: JsonSchema;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface CheckoutReceipt {
  total?: string | { amount: string; currency: string };
  merchantOrderId?: string;
  evidence?: unknown;
  [key: string]: unknown;
}

export interface Checkout {
  id: string;
  status: CheckoutStatus;
  target?: CheckoutTarget;
  constraints?: CheckoutConstraints;
  buyerProfileId?: string;
  pendingUserAction?: PendingUserAction | null;
  browser?: { embedUrl?: string; [key: string]: unknown };
  receipt?: CheckoutReceipt;
  failure?: { reason: CheckoutFailureReason; message?: string };
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface SubmitCheckoutActionInput {
  action: "submit";
  values: Record<string, unknown>;
}

export interface BuyerProfileInput {
  label: string;
  name: { first: string; last: string };
  contact: { email: string; phone?: string };
  shipping: {
    addressLines: string[];
    locality: string;
    /** ISO 3166-2, e.g. "US-CA". */
    administrativeAreaCode?: string;
    postalCode: string;
    /** ISO 3166-1 alpha-2. */
    countryCode: string;
  };
}

export interface BuyerProfile extends BuyerProfileInput {
  id: string;
}
