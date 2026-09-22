import type { UserAuth } from "@agent-commerce/auth";
import { createAgentCommerceHandlers, memoryRequestStore, type AgentCommerceServerConfig } from "../src/index.js";

export const BASE = "https://wallet.test/api/agent-commerce";

export const fakeUserAuth: UserAuth = {
  async verify(jwt) {
    if (jwt !== "good") return null;
    return { userId: "user-test-1", email: "a@b.c", jwt };
  },
};

export interface FakeCall {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

type Reply =
  { status?: number; body?: unknown } | ((call: FakeCall) => { status?: number; body?: unknown });

export interface FakeRoute {
  method: string;
  /** Matched against the URL path with `includes`, or a regex test. */
  path: string | RegExp;
  reply: Reply;
  /** Use this route at most once, then fall through to the next match. */
  once?: boolean;
}

/** A fake Crossmint. Routes match in order. Records every call. */
export function fakeCrossmint(routes: FakeRoute[]) {
  const calls: FakeCall[] = [];
  const used = new Set<FakeRoute>();
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = new URL(url).pathname;
    const headers = Object.fromEntries(
      Object.entries((init?.headers as Record<string, string>) ?? {}),
    );
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const call: FakeCall = { method, url, path, headers, body };
    calls.push(call);
    for (const route of routes) {
      if (route.method !== method) continue;
      const hit =
        typeof route.path === "string" ? path.includes(route.path) : route.path.test(path);
      if (!hit) continue;
      if (route.once && used.has(route)) continue;
      used.add(route);
      const r = typeof route.reply === "function" ? route.reply(call) : route.reply;
      const status = r.status ?? 200;
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ message: `no fake for ${method} ${path}` }), {
      status: 599,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

export function makeServer(routes: FakeRoute[] = [], overrides: Partial<AgentCommerceServerConfig> = {}) {
  const crossmint = fakeCrossmint(routes);
  const store = memoryRequestStore();
  const handlers = createAgentCommerceHandlers({
    crossmint: {
      clientApiKey: "ck_test",
      serverApiKey: "sk_test",
      environment: "staging",
      fetch: crossmint.fetch,
    },
    userAuth: fakeUserAuth,
    store,
    webBaseUrl: "https://wallet.test",
    apiBaseUrl: BASE,
    auth: {
      provider: "stytch",
      projectId: "project-test-123",
      environment: "test",
      cliClientId: "connected-app-cli",
    },
    ...overrides,
  });
  return { handlers, store, calls: crossmint.calls };
}

export function call(
  handlers: ReturnType<typeof createAgentCommerceHandlers>,
  method: string,
  path: string,
  opts: { body?: unknown; auth?: string | null } = {},
) {
  const headers: Record<string, string> = {};
  const auth = opts.auth === undefined ? "good" : opts.auth;
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const req = new Request(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return handlers.handler(req);
}

export const activeOrderIntent = (over: Record<string, unknown> = {}) => ({
  orderIntentId: "oi_1",
  paymentMethodId: "pm_1",
  description: "Flight to SF",
  status: "active",
  expiresAt: "2099-01-01T00:00:00.000Z",
  amount: { currency: "USD", total: "50.00", available: "50.00", reserved: "0.00", spent: "0.00" },
  rails: [
    { rail: "agentic-token", provider: "vic", status: "active", credentialFormats: ["card"] },
  ],
  ...over,
});

export const cardCredential = {
  id: "cred_1",
  rail: "agentic-token",
  provider: "vic",
  amount: { value: "50.00", currency: "USD" },
  credential: {
    format: "card",
    value: {
      number: "4111111111111111",
      expirationMonth: "12",
      expirationYear: "2030",
      cvc: "123",
    },
  },
  expiresAt: "2099-01-01T00:00:00.000Z",
};
