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
    const c = new CrossmintClient({ clientApiKey: "ck_test", environment: "staging", fetch: f, origin: "https://wallet.test/" });
    await c.orderIntents.create({ jwt: "jwt1" }, {
      paymentMethodId: "pm_1",
      amount: { value: "10.00", currency: "USD" },
      description: "x",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://staging.crossmint.com/api/unstable/order-intents");
    expect((init as RequestInit).headers).toMatchObject({ "X-API-KEY": "ck_test", Authorization: "Bearer jwt1", Origin: "https://wallet.test" });
  });
  it("sends server key and user id for checkouts, always to production", async () => {
    const f = mockFetch(202, { runId: "run_1", status: "queued" });
    const c = new CrossmintClient({ serverApiKey: "sk_test", environment: "staging", fetch: f });
    await c.checkouts.create({ userId: "u1" }, {
      request: { startUrl: "https://shop.example/p" },
      constraints: { maxCost: { amount: "10.00", currency: "USD" } },
    });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://www.crossmint.com/api/unstable/agent-checkouts");
    expect((init as RequestInit).headers).toMatchObject({ "X-API-KEY": "sk_test", "x-crossmint-user-id": "u1" });
  });
  it("answers an input request with one input_response message", async () => {
    const f = mockFetch(202, { messageId: "m1", status: "accepted" });
    const c = new CrossmintClient({ serverApiKey: "sk_test", fetch: f });
    await c.checkouts.respond({ userId: "u1" }, "run_1", "req_1", { size: "m" }, "my-id");
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://www.crossmint.com/api/unstable/agent-checkouts/run_1/messages");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      id: "my-id",
      parts: [{ type: "input_response", requestId: "req_1", action: "submit", response: { kind: "form", answers: { size: "m" } } }],
    });
  });
  it("throws CrossmintApiError on non-2xx", async () => {
    const c = new CrossmintClient({ clientApiKey: "ck", fetch: mockFetch(401, { message: "nope" }) });
    await expect(c.orderIntents.list({ jwt: "j" })).rejects.toBeInstanceOf(CrossmintApiError);
  });
});
