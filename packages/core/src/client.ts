import { CrossmintApiError } from "./errors.js";
import type {
  BuyerProfile,
  BuyerProfileInput,
  Checkout,
  CreateCheckoutInput,
  CreateOrderIntentInput,
  Credential,
  CrossmintEnvironment,
  MintCredentialInput,
  OrderIntent,
  PaymentMethod,
  PaymentMethodList,
  RegisterCardInput,
  RegisterCardResult,
  SubmitCheckoutActionInput,
} from "./types.js";

const BASE_URLS: Record<CrossmintEnvironment, string> = {
  staging: "https://staging.crossmint.com/api",
  production: "https://www.crossmint.com/api",
};

export interface CrossmintClientOptions {
  /**
   * Client-side API key (`ck_...`). Used with a user JWT for payment methods and order intents.
   */
  clientApiKey?: string;
  /**
   * Server-side API key (`sk_...`). Used with `x-crossmint-user-id` for agent checkouts.
   */
  serverApiKey?: string;
  environment?: CrossmintEnvironment;
  /** Override the base URL, e.g. for a proxy. Defaults from `environment`. */
  baseUrl?: string;
  /**
   * Agent Checkouts have no staging environment. They always go to production.
   * Set this to a different base if Crossmint gives you one.
   */
  checkoutsBaseUrl?: string;
  fetch?: typeof fetch;
}

/** Who the request acts for. Every payment-method and order-intent call needs a user JWT. */
export interface UserContext {
  jwt: string;
}

/**
 * Agent Checkouts accept either a client key + user JWT, or a server key + user id.
 */
export type CheckoutContext = { jwt: string } | { userId: string };

type Json = object | unknown[] | string | number | boolean | null;

export class CrossmintClient {
  readonly environment: CrossmintEnvironment;
  private readonly baseUrl: string;
  private readonly checkoutsBaseUrl: string;
  private readonly clientApiKey: string | undefined;
  private readonly serverApiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CrossmintClientOptions) {
    this.environment = opts.environment ?? "staging";
    this.baseUrl = (opts.baseUrl ?? BASE_URLS[this.environment]).replace(/\/$/, "");
    this.checkoutsBaseUrl = (opts.checkoutsBaseUrl ?? BASE_URLS.production).replace(/\/$/, "");
    this.clientApiKey = opts.clientApiKey;
    this.serverApiKey = opts.serverApiKey;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    if (!this.clientApiKey && !this.serverApiKey) {
      throw new Error("CrossmintClient needs a clientApiKey, a serverApiKey, or both.");
    }
  }

  // ---------------------------------------------------------------------
  // Payment methods
  // ---------------------------------------------------------------------

  readonly paymentMethods = {
    list: async (
      user: UserContext,
      query: { type?: string; limit?: number; cursor?: string } = {},
    ): Promise<PaymentMethodList> => {
      const params = new URLSearchParams();
      if (query.type) params.set("type", query.type);
      if (query.limit) params.set("limit", String(query.limit));
      if (query.cursor) params.set("cursor", query.cursor);
      const qs = params.size ? `?${params}` : "";
      const raw = await this.request<unknown>("GET", `/unstable/payment-methods${qs}`, {
        auth: this.userAuth(user),
      });
      return normalizePaymentMethodList(raw);
    },

    get: (user: UserContext, paymentMethodId: string): Promise<PaymentMethod> =>
      this.request<PaymentMethod>(
        "GET",
        `/unstable/payment-methods/${encodeURIComponent(paymentMethodId)}`,
        { auth: this.userAuth(user) },
      ),

    delete: (user: UserContext, paymentMethodId: string): Promise<void> =>
      this.request<void>(
        "DELETE",
        `/unstable/payment-methods/${encodeURIComponent(paymentMethodId)}`,
        { auth: this.userAuth(user) },
      ),

    /**
     * Register a saved card for agent cards. Idempotent. Returns which rails
     * (Visa Intelligent Commerce, Mastercard Agent Pay) can back an order intent.
     */
    registerForOrderIntents: (
      user: UserContext,
      paymentMethodId: string,
      input: RegisterCardInput,
    ): Promise<RegisterCardResult> =>
      this.request<RegisterCardResult>(
        "PUT",
        `/unstable/payment-methods/${encodeURIComponent(paymentMethodId)}/order-intent-registration`,
        { auth: this.userAuth(user), body: input },
      ),
  };

  // ---------------------------------------------------------------------
  // Order intents (agent cards)
  // ---------------------------------------------------------------------

  readonly orderIntents = {
    create: (user: UserContext, input: CreateOrderIntentInput): Promise<OrderIntent> =>
      this.request<OrderIntent>("POST", "/unstable/order-intents", {
        auth: this.userAuth(user),
        body: input,
      }),

    list: async (user: UserContext): Promise<OrderIntent[]> => {
      const raw = await this.request<unknown>("GET", "/unstable/order-intents", {
        auth: this.userAuth(user),
      });
      if (Array.isArray(raw)) return raw as OrderIntent[];
      if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        for (const key of ["orderIntents", "data", "items"]) {
          if (Array.isArray(obj[key])) return obj[key] as OrderIntent[];
        }
      }
      return [];
    },

    get: (user: UserContext, orderIntentId: string): Promise<OrderIntent> =>
      this.request<OrderIntent>(
        "GET",
        `/unstable/order-intents/${encodeURIComponent(orderIntentId)}`,
        { auth: this.userAuth(user) },
      ),

    revoke: (user: UserContext, orderIntentId: string): Promise<void> =>
      this.request<void>(
        "DELETE",
        `/unstable/order-intents/${encodeURIComponent(orderIntentId)}`,
        { auth: this.userAuth(user) },
      ),

    /** Mint a scoped credential from an active order intent. */
    mintCredential: (
      user: UserContext,
      orderIntentId: string,
      input: MintCredentialInput,
    ): Promise<Credential> =>
      this.request<Credential>(
        "POST",
        `/unstable/order-intents/${encodeURIComponent(orderIntentId)}/credentials`,
        { auth: this.userAuth(user), body: input },
      ),
  };

  // ---------------------------------------------------------------------
  // Agent checkouts
  // ---------------------------------------------------------------------

  readonly checkouts = {
    create: (ctx: CheckoutContext, input: CreateCheckoutInput): Promise<Checkout> =>
      this.request<Checkout>("POST", "/unstable/agent-checkouts", {
        auth: this.checkoutAuth(ctx),
        body: input,
        baseUrl: this.checkoutsBaseUrl,
      }),

    get: (ctx: CheckoutContext, checkoutId: string): Promise<Checkout> =>
      this.request<Checkout>(
        "GET",
        `/unstable/agent-checkouts/${encodeURIComponent(checkoutId)}`,
        { auth: this.checkoutAuth(ctx), baseUrl: this.checkoutsBaseUrl },
      ),

    submitAction: (
      ctx: CheckoutContext,
      checkoutId: string,
      actionId: string,
      input: SubmitCheckoutActionInput,
    ): Promise<Checkout> =>
      this.request<Checkout>(
        "POST",
        `/unstable/agent-checkouts/${encodeURIComponent(checkoutId)}/actions/${encodeURIComponent(actionId)}`,
        { auth: this.checkoutAuth(ctx), body: input, baseUrl: this.checkoutsBaseUrl },
      ),

    createBuyerProfile: (ctx: CheckoutContext, input: BuyerProfileInput): Promise<BuyerProfile> =>
      this.request<BuyerProfile>("POST", "/unstable/agent-checkouts/buyer-profiles", {
        auth: this.checkoutAuth(ctx),
        body: input,
        baseUrl: this.checkoutsBaseUrl,
      }),
  };

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private userAuth(user: UserContext): Record<string, string> {
    if (!this.clientApiKey) {
      throw new Error("This call needs a clientApiKey (ck_...) plus a user JWT.");
    }
    if (!user.jwt) throw new Error("This call needs a user JWT.");
    return { "X-API-KEY": this.clientApiKey, Authorization: `Bearer ${user.jwt}` };
  }

  private checkoutAuth(ctx: CheckoutContext): Record<string, string> {
    if ("jwt" in ctx) {
      if (!this.clientApiKey) throw new Error("Checkout with a JWT needs a clientApiKey.");
      return { "X-API-KEY": this.clientApiKey, Authorization: `Bearer ${ctx.jwt}` };
    }
    if (!this.serverApiKey) throw new Error("Checkout with a userId needs a serverApiKey.");
    return { "X-API-KEY": this.serverApiKey, "x-crossmint-user-id": ctx.userId };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    opts: { auth: Record<string, string>; body?: Json; baseUrl?: string },
  ): Promise<T> {
    const url = `${opts.baseUrl ?? this.baseUrl}${path}`;
    const headers: Record<string, string> = { Accept: "application/json", ...opts.auth };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    const res = await this.fetchImpl(url, { method, headers, body });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      throw new CrossmintApiError({ status: res.status, url, body: parsed });
    }
    return parsed as T;
  }
}

function normalizePaymentMethodList(raw: unknown): PaymentMethodList {
  if (Array.isArray(raw)) return { paymentMethods: raw as PaymentMethod[] };
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["paymentMethods", "data", "items"]) {
      if (Array.isArray(obj[key])) {
        return {
          paymentMethods: obj[key] as PaymentMethod[],
          nextCursor: typeof obj.nextCursor === "string" ? obj.nextCursor : undefined,
        };
      }
    }
  }
  return { paymentMethods: [] };
}
