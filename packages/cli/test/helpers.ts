import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContextOverrides } from "../src/context.js";
import { createConfigStore, type GoatConfig } from "../src/config.js";

export interface FakeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export type Route = (call: FakeCall) => Response | Promise<Response>;

/** A `fetch` that records calls and answers from a route table keyed by `METHOD path`. */
export function fakeFetch(routes: Record<string, Route>) {
  const calls: FakeCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k.toLowerCase()] = v));
    let body: unknown = undefined;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    } else if (init?.body instanceof URLSearchParams) {
      body = Object.fromEntries(init.body);
    }
    const call = { url, method, headers, body };
    calls.push(call);
    const pathname = new URL(url).pathname;
    const oauthIdx = pathname.indexOf("/oauth2/");
    const v1Idx = pathname.indexOf("/v1/");
    const path =
      oauthIdx >= 0 ? pathname.slice(oauthIdx) : v1Idx >= 0 ? pathname.slice(v1Idx) : pathname;
    const route = routes[`${method} ${path}`] ?? routes[`${method} ${url}`];
    if (!route)
      return new Response(
        JSON.stringify({ error: { code: "not_found", message: `no route ${method} ${path}` } }),
        { status: 404 },
      );
    return route(call);
  };
  return { fetch: fetchImpl, calls };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function tempConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "goat-cli-test-"));
}

/** Overrides with a temp config dir, captured output, and a saved session. */
export function testContext(opts: {
  fetch: typeof fetch;
  config?: Partial<GoatConfig> | null;
  env?: Record<string, string>;
}) {
  const dir = tempConfigDir();
  const env: Record<string, string | undefined> = { GOAT_CONFIG_DIR: dir, ...opts.env };
  const store = createConfigStore(env);
  if (opts.config !== null) {
    store.write({
      apiBaseUrl: "https://wallet.test/api/goat",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      tokenEndpoint: "https://test.stytch.com/v1/public/project-test-1/oauth2/token",
      clientId: "connected-app-1",
      ...opts.config,
    });
  }
  const stdout: string[] = [];
  const stderr: string[] = [];
  const overrides: ContextOverrides = {
    env,
    fetch: opts.fetch,
    out: (l = "") => stdout.push(stripAnsi(l)),
    err: (l = "") => stderr.push(stripAnsi(l)),
    config: store,
    hostname: () => "testbox",
    sleep: async () => {},
    openBrowser: async () => {},
    prompt: async () => "",
    color: false,
  };
  return { overrides, stdout, stderr, store, dir };
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
export function stripAnsi(s: string): string {
  return s.replace(ANSI, "");
}
