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
  /** How Crossmint draws the method: the network's artwork and its own label. */
  display?: PaymentMethodDisplay;
}

export interface PaymentMethodDisplay {
  /** Card network artwork, e.g. `https://www.crossmint.com/assets/cards/visa.svg`. */
  imageUrl?: string;
  label?: string;
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

/**
 * `pending_verification`: the card network still wants a word with the user.
 * `pending_cvc_recollection`: the vault's copy of the saved card's security
 * code lapsed, so the user has to type it again before this rail mints.
 */
export type RailStatus =
  | "active"
  | "pending_verification"
  | "pending_cvc_recollection"
  | "error"
  | (string & {});

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

/** Agent Commerce's user-facing name for an order intent. */
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
// Mirrors https://docs.crossmint.com/api-reference/agent-checkouts/create-agent-checkout
// A checkout is a run: create it, poll it (or stream its messages) until a
// terminal status, and answer each input request by sending a message.

export type CheckoutStatus =
  | "queued"
  | "running"
  | "awaiting_input"
  | "succeeded"
  | "blocked"
  | "failed"
  | "cancelled"
  | (string & {});

/** Why a run `failed`: the run itself broke. */
export type CheckoutFailureReason =
  | "input_expired"
  | "cost_limit"
  | "cancelled"
  | "model_error"
  | "runtime_error"
  | "browser_session_lost"
  | "accounting_unavailable"
  | "reconciliation_required"
  | (string & {});

/** Why a run ended `blocked`: the agent stopped on purpose. */
export type CheckoutBlockedCode =
  | "policy.max_cost_exceeded"
  | "product.item_unavailable"
  | "product.requested_option_unavailable"
  | "merchant.fulfillment_unavailable"
  | "merchant.human_verification_required"
  | "merchant.access_blocked"
  | "merchant.payment_declined"
  | "merchant.checkout_error"
  | "merchant.no_safe_path"
  | (string & {});

export interface CheckoutRequest {
  /** Product or cart page to start from. */
  startUrl: string;
  /** Natural-language instruction for the agent, e.g. "buy the medium in black". Up to 20000 chars. */
  task?: string;
}

export interface CheckoutConstraints {
  maxCost: { amount: string; currency: string };
}

export interface CreateCheckoutInput {
  request: CheckoutRequest;
  constraints: CheckoutConstraints;
  /** Saved name, contact and shipping. */
  buyerProfileId?: string;
  /** Saved merchant logins. */
  browserProfileId?: string;
  /** Notes about the store for the agent. Up to 20000 chars. */
  merchantGuidance?: string;
}

/** What a payment input request asks the caller to authorize. */
export interface CheckoutPaymentAmount {
  /** `exact` is the verified payable total; `maximum` is the run's cost ceiling. */
  kind: "exact" | "maximum" | (string & {});
  /** Decimal string, e.g. "42.50". */
  value: string;
  currency: string;
}

/** A free-text field. `display: "masked"` hides what is typed. */
export type CheckoutTextInput = {
  kind: "text";
  multiline?: boolean;
  placeholder?: string;
  display?: "masked";
  /** An HTML autocomplete token. */
  autoComplete?:
    | "on"
    | "off"
    | "name"
    | "given-name"
    | "family-name"
    | "email"
    | "username"
    | "tel"
    | "current-password"
    | "new-password"
    | "one-time-code"
    | "street-address"
    | "postal-code";
  /** An HTML inputmode. */
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
};

/** One option of a choice. A `placeholder` option ("Select a size") is never an answer. */
export type CheckoutChoiceOption = {
  value: string;
  label: string;
  disabled: boolean;
  selected: boolean;
  placeholder: boolean;
};

export type CheckoutChoiceInput = {
  kind: "choice";
  /** `one`: answer with one option value. `many`: answer with a list of them. */
  selection: { kind: "one" } | { kind: "many"; min: number; max?: number };
  options: CheckoutChoiceOption[];
};

export type CheckoutFieldInput =
  | CheckoutTextInput
  | { kind: "boolean" }
  | { kind: "number" }
  | { kind: "integer" }
  | CheckoutChoiceInput;

/** A field the caller answers with a plain value. */
export interface CheckoutStandardField {
  /** The answer's key. */
  key: string;
  label: string;
  required: boolean;
  handling: "standard";
  input: CheckoutFieldInput;
}

/**
 * A field holding a secret, such as a password or a one-time code. Never
 * answered with a value: the buyer types it into Crossmint's protected field
 * (`CrossmintProtectedInput`), and the answer is only the id it returns,
 * `{ protectedInputId }`. The request carries no secret.
 */
export interface CheckoutProtectedField {
  key: string;
  label: string;
  required: boolean;
  handling: "protected";
  input: (CheckoutTextInput & { multiline?: false }) | { kind: "number" } | { kind: "integer" };
}

export type CheckoutField = CheckoutStandardField | CheckoutProtectedField;

/**
 * `form`: answer each field by its `key` (`submitResponse`). `payment`: the
 * payment step; answer with an order intent (`paymentResponse`), never with
 * card details.
 */
export type CheckoutInteraction =
  | { kind: "form"; fields: CheckoutField[] }
  | {
      kind: "payment";
      /** "checkout_payment". */
      purpose: string;
      /** What the checkout accepts. Today always "card". */
      method: "card" | (string & {});
      /** The total to authorize, which the order intent must match. */
      amount: CheckoutPaymentAmount;
      /** The store the credential is bound to. */
      merchant: { name: string; url: string; countryCode: string };
    };

/**
 * One form answer. A standard field takes a string, number, boolean or, for a
 * choice of many, a list of option values. A protected field takes only the
 * id Crossmint's protected field returned.
 */
export type CheckoutFormAnswer = string | number | boolean | string[] | { protectedInputId: string };

/** What the agent is asking, as it appears in `requiredAction.request` and in `input_request` message parts. */
export interface CheckoutInputRequest {
  question: string;
  /** Answer before this or the run fails with `input_expired`. */
  expiresAt: string;
  interaction: CheckoutInteraction;
}

/** The run's open question. Present while `status` is `awaiting_input`. */
export interface CheckoutRequiredAction {
  type: "input_response";
  requestId: string;
  messageId: string;
  request: CheckoutInputRequest;
}

/**
 * Agent Commerce's flat view of an open input request. `id` is the `requestId` to
 * answer with. Built from `requiredAction` by `pendingActionOf`.
 */
export interface PendingUserAction {
  id: string;
  messageId?: string;
  question: string;
  expiresAt?: string;
  /** The form's fields, in order. Empty on the payment step. */
  fields: CheckoutField[];
  /** Set when this is the payment step: what to authorize, and where. */
  payment?: {
    method: string;
    amount: CheckoutPaymentAmount;
    merchant: { name: string; url: string; countryCode: string };
  };
}

export interface CheckoutReceipt {
  total: { amount: string; currency: string };
  merchantOrderId?: string;
}

export type CheckoutPurchase =
  | { kind: "confirmed_without_receipt" }
  | { kind: "receipt_captured"; receipt: CheckoutReceipt };

export interface CheckoutResult {
  outcome: "succeeded" | "blocked" | "cancelled" | "failed" | (string & {});
  summary: string;
  /** On `blocked`. */
  code?: CheckoutBlockedCode;
  /** On `succeeded`. */
  purchase?: CheckoutPurchase;
}

export interface Checkout {
  runId: string;
  status: CheckoutStatus;
  revision: number;
  createdAt: string;
  input: CreateCheckoutInput;
  /** View-only live browser. `null` while no session is attached. */
  browser?: { embedUrl: string; permissions: Array<"read" | (string & {})> } | null;
  requiredAction?: CheckoutRequiredAction | null;
  /** On `succeeded`, `blocked` and `cancelled`. */
  result?: CheckoutResult;
  /** On `failed`. */
  reason?: CheckoutFailureReason;
  knownSpentUsdMicros?: number;
  [key: string]: unknown;
}

export interface CheckoutList {
  data: Checkout[];
  nextCursor: string | null;
}

// Messages. The agent writes progress, activity, input requests and the
// result; the caller writes input responses and free text.

export type InputResponsePart =
  | { type: "input_response"; requestId: string; action: "submit"; response: { kind: "form"; answers: Record<string, CheckoutFormAnswer> } }
  | { type: "input_response"; requestId: string; action: "submit"; response: { kind: "payment"; orderIntentId: string } }
  | { type: "input_response"; requestId: string; action: "decline" }
  | { type: "input_response"; requestId: string; action: "alternative"; text: string };

export interface TextPart {
  type: "text";
  text: string;
  delivery?: "accepted" | "consumed";
}

export interface InputRequestPart extends CheckoutInputRequest {
  type: "input_request";
  requestId: string;
  status: "open" | "closed";
}

export interface ActivityPart {
  type: "activity";
  status: "running" | "completed" | "incomplete" | "uncertain";
  operations: Array<{ kind: string; count: number }>;
}

export interface ProgressPart {
  type: "progress";
  text: string;
}

export type ResultPart = CheckoutResult & { type: "result" };

export type CheckoutMessagePart =
  | InputResponsePart
  | TextPart
  | InputRequestPart
  | ActivityPart
  | ProgressPart
  | ResultPart
  | { type: string; [key: string]: unknown };

export interface CheckoutMessage {
  id: string;
  role: "assistant" | "user";
  createdAt: string;
  revision: number;
  parts: CheckoutMessagePart[];
}

export interface CheckoutMessageList {
  data: CheckoutMessage[];
  nextCursor: string | null;
  /** Resume point for the SSE stream. */
  streamCursor: string;
}

/** Parts a caller may send. */
export type OutboundMessagePart = InputResponsePart | { type: "text"; text: string };

export interface SendCheckoutMessageInput {
  /** Your own unique id, up to 200 chars. A retry with the same id is applied once. */
  id: string;
  parts: OutboundMessagePart[];
}

export interface SendCheckoutMessageResult {
  messageId: string;
  status: "accepted";
}

export interface CancelCheckoutResult {
  runId: string;
  status: "accepted";
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
  createdAt?: string;
  updatedAt?: string;
}

export interface BuyerProfileList {
  data: BuyerProfile[];
  nextCursor?: string | null;
}

export interface BrowserProfileInput {
  /** 1-120 characters. What the saved logins are for, in the user's words. */
  label: string;
}

/**
 * A user's saved merchant logins.
 *
 * Metadata only: the browser state itself stays opaque to Crossmint and never
 * comes back over the API, so there are no cookies or tokens in this shape and
 * nothing here reaches a model. A user holds at most one, and deleting it
 * erases the state, not just the record.
 */
export interface BrowserProfile extends BrowserProfileInput {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrowserProfileList {
  data: BrowserProfile[];
  nextCursor?: string | null;
}
