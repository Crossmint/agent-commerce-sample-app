import { describe, expect, it, vi } from "vitest";
import { createAgentCommerceApi } from "../src/api/client.js";

const profile = { buyerProfile: { id: "byp_1" } };

function fakeFetch(statuses: number[]) {
  const seen: string[] = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    seen.push(String((init?.headers as Record<string, string>).Authorization));
    const status = statuses[seen.length - 1] ?? 200;
    return new Response(
      status === 200 ? JSON.stringify(profile) : JSON.stringify({ error: { code: "unauthorized", message: "Invalid or expired token" } }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, seen };
}

describe("the API client", () => {
  it("renews an expired JWT once, and sends the request again with the new one", async () => {
    const { fetch, seen } = fakeFetch([401, 200]);
    const renewJwt = vi.fn(async () => "fresh");
    const api = createAgentCommerceApi({ getJwt: () => "stale", renewJwt, fetch });
    await expect(api.getBuyerProfile()).resolves.toEqual({ id: "byp_1" });
    expect(renewJwt).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["Bearer stale", "Bearer fresh"]);
  });

  it("gives up after one renewal, and reports the 401", async () => {
    const { fetch, seen } = fakeFetch([401, 401]);
    const api = createAgentCommerceApi({ getJwt: () => "stale", renewJwt: async () => "fresh", fetch });
    await expect(api.getBuyerProfile()).rejects.toMatchObject({ status: 401 });
    expect(seen).toHaveLength(2);
  });

  it("does not retry when the session cannot be renewed", async () => {
    const { fetch, seen } = fakeFetch([401]);
    const api = createAgentCommerceApi({ getJwt: () => "stale", renewJwt: async () => null, fetch });
    await expect(api.getBuyerProfile()).rejects.toMatchObject({ status: 401 });
    expect(seen).toHaveLength(1);
  });
});
