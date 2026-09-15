import { describe, expect, it, vi } from "vitest";
import { CrossmintClient } from "../src/client.js";
import { CrossmintApiError } from "../src/errors.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("CrossmintClient", () => {
  it("sends client key and JWT for order intents", async () => {
    const f = mockFetch(201, { orderIntentId: "oi_1" });
    const c = new CrossmintClient({ clientApiKey: "ck_test", environment: "staging", fetch: f });
    await c.orderIntents.create({ jwt: "jwt1" }, {
      paymentMethodId: "pm_1",
      amount: { value: "10.00", currency: "USD" },
      description: "x",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://staging.crossmint.com/api/unstable/order-intents");
    expect((init as RequestInit).headers).toMatchObject({ "X-API-KEY": "ck_test", Authorization: "Bearer jwt1" });
  });
  it("sends server key and user id for checkouts, always to production", async () => {
    const f = mockFetch(201, { id: "co_1", status: "pending" });
    const c = new CrossmintClient({ serverApiKey: "sk_test", environment: "staging", fetch: f });
    await c.checkouts.create({ userId: "u1" }, {
      target: { kind: "direct_url", url: "https://shop.example/p" },
      constraints: { maxCost: { amount: "10.00", currency: "USD" } },
    });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://www.crossmint.com/api/unstable/agent-checkouts");
    expect((init as RequestInit).headers).toMatchObject({ "X-API-KEY": "sk_test", "x-crossmint-user-id": "u1" });
  });
  it("throws CrossmintApiError on non-2xx", async () => {
    const c = new CrossmintClient({ clientApiKey: "ck", fetch: mockFetch(401, { message: "nope" }) });
    await expect(c.orderIntents.list({ jwt: "j" })).rejects.toBeInstanceOf(CrossmintApiError);
  });
});
