import { newMessageId, paymentResponse, submitResponse } from "./checkout-messages.js";
import { CrossmintApiError } from "./errors.js";
import type {
  CheckoutFormAnswer,
  BrowserProfile,
  BrowserProfileInput,
  BrowserProfileList,
  BuyerProfile,
  BuyerProfileInput,
  BuyerProfileList,
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
  CancelCheckoutResult,
  CheckoutList,
  CheckoutMessageList,
  SendCheckoutMessageInput,
  SendCheckoutMessageResult,
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
  /**
   * Sent as the `Origin` header on client-key calls. Crossmint locks client keys to
   * whitelisted origins and rejects server-side calls without one. Use your wallet's
   * public URL, e.g. `https://wallet.example.com`, and whitelist it in the console.
   */
  origin?: string;
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
  private readonly origin: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CrossmintClientOptions) {
    this.environment = opts.environment ?? "staging";
    this.baseUrl = (opts.baseUrl ?? BASE_URLS[this.environment]).replace(/\/$/, "");
    this.checkoutsBaseUrl = (opts.checkoutsBaseUrl ?? BASE_URLS.production).replace(/\/$/, "");
    this.clientApiKey = opts.clientApiKey;
    this.serverApiKey = opts.serverApiKey;
    this.origin = opts.origin?.replace(/\/$/, "");
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
    /** Start a run. Returns 202 with the run in `queued`. */
    create: (ctx: CheckoutContext, input: CreateCheckoutInput): Promise<Checkout> =>
      this.request<Checkout>("POST", "/unstable/agent-checkouts", {
        auth: this.checkoutAuth(ctx),
        body: input,
        baseUrl: this.checkoutsBaseUrl,
      }),

    get: (ctx: CheckoutContext, runId: string): Promise<Checkout> =>
      this.request<Checkout>("GET", `/unstable/agent-checkouts/${encodeURIComponent(runId)}`, {
        auth: this.checkoutAuth(ctx),
        baseUrl: this.checkoutsBaseUrl,
      }),

    list: (ctx: CheckoutContext, opts: { cursor?: string; limit?: number } = {}): Promise<CheckoutList> =>
      this.request<CheckoutList>("GET", `/unstable/agent-checkouts${pageQuery(opts)}`, {
        auth: this.checkoutAuth(ctx),
        baseUrl: this.checkoutsBaseUrl,
      }),

    /** The run's transcript: progress, activity, input requests, result, and what the caller sent. */
    listMessages: (
      ctx: CheckoutContext,
      runId: string,
      opts: { cursor?: string; limit?: number } = {},
    ): Promise<CheckoutMessageList> =>
      this.request<CheckoutMessageList>(
        "GET",
        `/unstable/agent-checkouts/${encodeURIComponent(runId)}/messages${pageQuery(opts)}`,
        { auth: this.checkoutAuth(ctx), baseUrl: this.checkoutsBaseUrl },
      ),

    /**
     * The run's transcript as it happens: a `text/event-stream` of
     * `message.upsert` (a message, new or changed) and `run.updated` events.
     * Each event's `id` is a cursor: pass it back as `after` (or
     * `lastEventId`) to resume. A stale cursor closes the stream at once;
     * Crossmint's advice is to re-read `listMessages` and reconnect from the
     * `streamCursor` it reports. Returns the raw Response for the caller to
     * read or pass on; a failed open throws like any other call.
     */
    streamMessages: async (
      ctx: CheckoutContext,
      runId: string,
      opts: { after?: string; lastEventId?: string; signal?: AbortSignal } = {},
    ): Promise<Response> => {
      const q = opts.after ? `?after=${encodeURIComponent(opts.after)}` : "";
      const url = `${this.checkoutsBaseUrl}/unstable/agent-checkouts/${encodeURIComponent(runId)}/messages/stream${q}`;
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...this.checkoutAuth(ctx),
          ...(opts.lastEventId ? { "Last-Event-ID": opts.lastEventId } : {}),
        },
        signal: opts.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          // keep the text
        }
        throw new CrossmintApiError({ status: res.status, url, body });
      }
      return res;
    },

    /** Send input responses or free text. Returns as soon as the message is accepted. */
    sendMessage: (ctx: CheckoutContext, runId: string, input: SendCheckoutMessageInput): Promise<SendCheckoutMessageResult> =>
      this.request<SendCheckoutMessageResult>(
        "POST",
        `/unstable/agent-checkouts/${encodeURIComponent(runId)}/messages`,
        { auth: this.checkoutAuth(ctx), body: input, baseUrl: this.checkoutsBaseUrl },
      ),

    /**
     * Answer an open form with every field in one message, keyed by field
     * `key`. A protected field's answer is the `{ protectedInputId }` that
     * Crossmint's protected field returned.
     */
    respond: (
      ctx: CheckoutContext,
      runId: string,
      requestId: string,
      answers: Record<string, CheckoutFormAnswer>,
      messageId?: string,
    ): Promise<SendCheckoutMessageResult> =>
      this.checkouts.sendMessage(ctx, runId, {
        id: messageId ?? newMessageId(),
        parts: [submitResponse(requestId, answers)],
      }),

    /** Answer the payment step with an order intent the user authorized. */
    payWithOrderIntent: (
      ctx: CheckoutContext,
      runId: string,
      requestId: string,
      orderIntentId: string,
      messageId?: string,
    ): Promise<SendCheckoutMessageResult> =>
      this.checkouts.sendMessage(ctx, runId, {
        id: messageId ?? newMessageId(),
        parts: [paymentResponse(requestId, orderIntentId)],
      }),

    cancel: (ctx: CheckoutContext, runId: string): Promise<CancelCheckoutResult> =>
      this.request<CancelCheckoutResult>(
        "POST",
        `/unstable/agent-checkouts/${encodeURIComponent(runId)}/cancel`,
        { auth: this.checkoutAuth(ctx), baseUrl: this.checkoutsBaseUrl },
      ),

    createBuyerProfile: (ctx: CheckoutContext, input: BuyerProfileInput): Promise<BuyerProfile> =>
      this.request<BuyerProfile>("POST", "/unstable/agent-checkouts/buyer-profiles", {
        auth: this.checkoutAuth(ctx),
        body: input,
        baseUrl: this.checkoutsBaseUrl,
      }),

    /**
     * The user's saved buyer profiles: name, contact and shipping. A user can
     * hold several. Whose they are is decided by `ctx`, as for browser profiles.
     */
    listBuyerProfiles: (
      ctx: CheckoutContext,
      opts: { cursor?: string; limit?: number } = {},
    ): Promise<BuyerProfileList> =>
      this.request<BuyerProfileList>(
        "GET",
        `/unstable/agent-checkouts/buyer-profiles${pageQuery(opts)}`,
        { auth: this.checkoutAuth(ctx), baseUrl: this.checkoutsBaseUrl },
      ),

    /**
     * Delete one saved buyer profile. A later checkout that names it fails,
     * so drop any id kept for it. Needs the key scope
     * `agent-checkouts.buyer-profiles.delete`.
     */
    deleteBuyerProfile: (ctx: CheckoutContext, profileId: string): Promise<void> =>
      this.request<void>(
        "DELETE",
        `/unstable/agent-checkouts/buyer-profiles/${encodeURIComponent(profileId)}`,
        { auth: this.checkoutAuth(ctx), baseUrl: this.checkoutsBaseUrl },
      ),

    /**
     * The user's saved merchant logins. At most one comes back, because a user
     * holds at most one profile.
     *
     * Whose logins these are is decided entirely by `ctx`: a JWT names the
     * user, and a server key needs `x-crossmint-user-id` beside it. Pass a
     * server key with no user and Crossmint files every end user's logins
     * under the project's own subject, in one shared profile. `checkoutAuth`
     * will not build that combination.
     */
    listBrowserProfiles: (
      ctx: CheckoutContext,
      opts: { cursor?: string; limit?: number } = {},
    ): Promise<BrowserProfileList> =>
      this.request<BrowserProfileList>(
        "GET",
        `/unstable/agent-checkouts/browser-profiles${pageQuery(opts)}`,
        { auth: this.checkoutAuth(ctx), baseUrl: this.checkoutsBaseUrl },
      ),

    /** Create the user's one profile. A second returns 409. */
    createBrowserProfile: (
      ctx: CheckoutContext,
      input: BrowserProfileInput,
    ): Promise<BrowserProfile> =>
      this.request<BrowserProfile>("POST", "/unstable/agent-checkouts/browser-profiles", {
        auth: this.checkoutAuth(ctx),
        body: input,
        baseUrl: this.checkoutsBaseUrl,
      }),

    /**
     * Forget the saved logins. Irreversible: it erases the browser state, not
     * just the record. Another user's id returns 404 rather than 403, so an id
     * cannot be probed for existence.
     */
    deleteBrowserProfile: (ctx: CheckoutContext, profileId: string): Promise<void> =>
      this.request<void>(
        "DELETE",
        `/unstable/agent-checkouts/browser-profiles/${encodeURIComponent(profileId)}`,
        { auth: this.checkoutAuth(ctx), baseUrl: this.checkoutsBaseUrl },
      ),
  };

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private userAuth(user: UserContext): Record<string, string> {
    if (!this.clientApiKey) {
      throw new Error("This call needs a clientApiKey (ck_...) plus a user JWT.");
    }
    if (!user.jwt) throw new Error("This call needs a user JWT.");
    return this.withOrigin({ "X-API-KEY": this.clientApiKey, Authorization: `Bearer ${user.jwt}` });
  }

  private withOrigin(headers: Record<string, string>): Record<string, string> {
    return this.origin ? { ...headers, Origin: this.origin } : headers;
  }

  private checkoutAuth(ctx: CheckoutContext): Record<string, string> {
    if ("jwt" in ctx) {
      if (!this.clientApiKey) throw new Error("Checkout with a JWT needs a clientApiKey.");
      return this.withOrigin({ "X-API-KEY": this.clientApiKey, Authorization: `Bearer ${ctx.jwt}` });
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

/** `?cursor=…&limit=…` or an empty string. */
function pageQuery(opts: { cursor?: string; limit?: number }): string {
  const q = new URLSearchParams();
  if (opts.cursor) q.set("cursor", opts.cursor);
  if (opts.limit !== undefined) q.set("limit", String(opts.limit));
  const str = q.toString();
  return str ? `?${str}` : "";
}
