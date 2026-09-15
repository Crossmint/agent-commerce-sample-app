import { refreshAccessToken } from "@goat-wallet/auth";
import type { AgentCard, BuyerProfileInput, PaymentMethodList } from "@goat-wallet/core";
import type { ConfigStore, ResolvedConfig } from "./config.js";
import { EXIT, CliExit } from "./output.js";
import type {
  AgentCardRequest,
  ApiErrorEnvelope,
  CheckoutView,
  CreateAgentCardRequestBody,
  CreateCheckoutBody,
  CredentialResponse,
  Me,
  MintCredentialBody,
  PublicConfig,
} from "./types.js";

/** Refresh the access token when it expires within this window. */
export const REFRESH_WINDOW_MS = 60_000;

/** An error envelope from the GOAT server, or a transport failure. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  constructor(opts: { code: string; message: string; status: number; details?: unknown }) {
    super(opts.message);
    this.name = "ApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }

  /** Exit code for the CLI. `unauthorized` means the session is gone. */
  get exitCode(): number {
    return this.code === "unauthorized" ? EXIT.NOT_LOGGED_IN : EXIT.ERROR;
  }

  override toString(): string {
    return `${this.code}: ${this.message}`;
  }
}

export interface ApiClientOptions {
  config: ResolvedConfig;
  fetch?: typeof fetch;
  /** Persists refreshed tokens. Omit to keep them in memory only. */
  store?: ConfigStore;
  now?: () => number;
}

export interface RequestOptions {
  body?: unknown;
  /** Skip the bearer header. Only `GET /v1/config` uses this. */
  noAuth?: boolean;
}

/** Public config needs no session. */
export async function fetchPublicConfig(
  apiBaseUrl: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<PublicConfig> {
  const res = await fetchImpl(`${apiBaseUrl}/v1/config`, {
    headers: { Accept: "application/json" },
  });
  return parseResponse<PublicConfig>(res);
}

/**
 * Thin typed wrapper over the routes in docs/API.md.
 * Adds the bearer token, refreshes it when near expiry, and turns the
 * error envelope into an `ApiError`.
 */
export class GoatApi {
  private config: ResolvedConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly store: ConfigStore | undefined;
  private readonly now: () => number;
  private refreshing: Promise<void> | null = null;

  constructor(opts: ApiClientOptions) {
    this.config = opts.config;
    this.fetchImpl = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.store = opts.store;
    this.now = opts.now ?? (() => Date.now());
  }

  get baseUrl(): string {
    return this.config.apiBaseUrl;
  }

  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (!opts.noAuth) headers.Authorization = `Bearer ${await this.accessToken()}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (e) {
      throw new ApiError({
        code: "network_error",
        status: 0,
        message: `Could not reach ${this.config.apiBaseUrl}: ${(e as Error).message}`,
      });
    }
    return parseResponse<T>(res);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body: body ?? {} });
  }

  delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }

  // --- Typed routes -------------------------------------------------------

  me(): Promise<Me> {
    return this.get("/v1/me");
  }

  listPaymentMethods(): Promise<PaymentMethodList> {
    return this.get("/v1/payment-methods");
  }

  createAgentCardRequest(body: CreateAgentCardRequestBody): Promise<AgentCardRequest> {
    return this.post("/v1/agent-card-requests", body);
  }

  getAgentCardRequest(id: string): Promise<AgentCardRequest> {
    return this.get(`/v1/agent-card-requests/${encodeURIComponent(id)}`);
  }

  listAgentCards(): Promise<{ agentCards: AgentCard[] }> {
    return this.get("/v1/agent-cards");
  }

  getAgentCard(id: string): Promise<AgentCard> {
    return this.get(`/v1/agent-cards/${encodeURIComponent(id)}`);
  }

  revokeAgentCard(id: string): Promise<void> {
    return this.delete(`/v1/agent-cards/${encodeURIComponent(id)}`);
  }

  mintCredential(id: string, body: MintCredentialBody): Promise<CredentialResponse> {
    return this.post(`/v1/agent-cards/${encodeURIComponent(id)}/credentials`, body);
  }

  createCheckout(body: CreateCheckoutBody): Promise<CheckoutView> {
    return this.post("/v1/checkouts", body);
  }

  getCheckout(id: string): Promise<CheckoutView> {
    return this.get(`/v1/checkouts/${encodeURIComponent(id)}`);
  }

  answerCheckout(
    id: string,
    actionId: string,
    values: Record<string, unknown>,
  ): Promise<CheckoutView> {
    return this.post(
      `/v1/checkouts/${encodeURIComponent(id)}/actions/${encodeURIComponent(actionId)}`,
      { values },
    );
  }

  createBuyerProfile(body: BuyerProfileInput): Promise<{ id: string }> {
    return this.post("/v1/buyer-profiles", body);
  }

  // --- Tokens -------------------------------------------------------------

  /** Current access token, refreshed first when it is about to expire. */
  async accessToken(): Promise<string> {
    if (!this.config.accessToken) {
      throw new CliExit(
        EXIT.NOT_LOGGED_IN,
        "Not logged in. Run `goat login --api <url>` first.",
        "not_logged_in",
      );
    }
    if (this.needsRefresh()) {
      this.refreshing ??= this.refresh().finally(() => {
        this.refreshing = null;
      });
      await this.refreshing;
    }
    return this.config.accessToken;
  }

  needsRefresh(): boolean {
    const { tokenFromEnv, expiresAt, refreshToken, tokenEndpoint, clientId } = this.config;
    if (tokenFromEnv || !expiresAt || !refreshToken || !tokenEndpoint || !clientId) return false;
    const exp = new Date(expiresAt).getTime();
    return Number.isFinite(exp) && exp - this.now() < REFRESH_WINDOW_MS;
  }

  private async refresh(): Promise<void> {
    const { refreshToken, tokenEndpoint, clientId } = this.config;
    if (!refreshToken || !tokenEndpoint || !clientId) return;
    let token;
    try {
      token = await withFetch(this.fetchImpl, () =>
        refreshAccessToken({ tokenEndpoint, clientId, refreshToken }),
      );
    } catch (e) {
      throw new CliExit(
        EXIT.NOT_LOGGED_IN,
        `Session expired and refresh failed (${(e as Error).message}). Run \`goat login\` again.`,
        "not_logged_in",
      );
    }
    this.config = {
      ...this.config,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: new Date(this.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    };
    if (this.store) {
      const { tokenFromEnv: _omit, ...persisted } = this.config;
      this.store.write(persisted);
    }
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
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
    const envelope = json as Partial<ApiErrorEnvelope> | undefined;
    if (envelope?.error?.code) {
      throw new ApiError({
        code: envelope.error.code,
        message: envelope.error.message ?? "",
        status: res.status,
        details: envelope.error.details,
      });
    }
    throw new ApiError({
      code: `http_${res.status}`,
      message: text.slice(0, 300) || res.statusText || `HTTP ${res.status}`,
      status: res.status,
    });
  }
  return json as T;
}

/**
 * `@goat-wallet/auth` calls the global `fetch`. Swap it for the duration of
 * one call so tests and custom transports stay in control.
 */
export async function withFetch<T>(fetchImpl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  if (fetchImpl === original) return fn();
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}
