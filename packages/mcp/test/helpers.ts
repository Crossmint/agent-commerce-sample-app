import { vi } from "vitest";

export type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

/** A fetch mock that routes on `METHOD /path` and returns JSON. */
export function mockGoatFetch(routes: Record<string, { status?: number; body?: unknown } | ((init?: RequestInit) => unknown)>) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const key = `${(init?.method ?? "GET").toUpperCase()} ${url.pathname.replace(/^\/api\/goat/, "")}`;
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({ error: { code: "not_found", message: `no route ${key}` } }), { status: 404 });
    const value = typeof route === "function" ? { body: route(init) } : route;
    return new Response(value.body === undefined ? null : JSON.stringify(value.body), {
      status: value.status ?? (value.body === undefined ? 204 : 200),
      headers: { "content-type": "application/json" },
    });
  }) as unknown as FetchMock;
}
