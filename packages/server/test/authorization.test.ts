import { describe, expect, it, vi } from "vitest";
import { activeOrderIntent, call, makeServer } from "./helpers.js";

const merchant = { name: "Shop", url: "https://shop.example", countryCode: "US" };
const input = { amount: { value: "50.00", currency: "USD" }, description: "Purchase", merchant };

async function setup(overrides: Record<string, unknown> = {}) {
  let card: ReturnType<typeof activeOrderIntent>;
  const server = makeServer([
    {
      method: "GET",
      path: "/unstable/order-intents/oi_missing",
      reply: { status: 404, body: { message: "Not found" } },
    },
    {
      method: "GET",
      path: "/unstable/order-intents/oi_1",
      reply: () => ({ body: card }),
    },
  ]);
  const created = await call(server.handlers, "POST", "/v1/agent-card-requests", { body: input });
  expect(created.status).toBe(201);
  const request = await created.json();
  card = activeOrderIntent({
    merchant,
    description: input.description,
    expiresAt: request.expiresAt,
    ...overrides,
  });
  return {
    ...server,
    request,
    authorize: (id = "oi_1") =>
      call(server.handlers, "POST", `/v1/agent-card-requests/${request.id}/authorized`, {
        body: { orderIntentId: id },
      }),
  };
}

describe("SDK authorization handoff", () => {
  it("requires a real merchant on new requests", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "POST", "/v1/agent-card-requests", {
      body: { ...input, merchant: undefined },
    });
    expect(res.status).toBe(400);
  });

  it("requires merchant metadata before starting a new checkout", async () => {
    const { handlers, calls } = makeServer();
    const res = await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: merchant.url, maxCost: { amount: "50", currency: "USD" } },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("merchant_required");
    expect(calls).toHaveLength(0);
  });

  it("does not accept a merchant different from the checkout site", async () => {
    const { handlers, calls } = makeServer();
    const res = await call(handlers, "POST", "/v1/checkouts", {
      body: {
        merchant,
        startUrl: "https://other.example",
        maxCost: { amount: "50", currency: "USD" },
      },
    });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("attaches the JWT-scoped order intent without registration or creation", async () => {
    const s = await setup();
    const res = await s.authorize();
    expect(res.status).toBe(200);
    expect((await res.json()).request).toMatchObject({
      status: "active",
      agentCardId: "oi_1",
      paymentMethodId: "pm_1",
    });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]?.method).toBe("GET");
    expect(Object.values(s.calls[0]!.headers)).toContain("Bearer good");
    expect((await s.authorize()).status).toBe(200);
    expect(s.calls).toHaveLength(1);
  });

  it("handles simultaneous duplicate callbacks idempotently", async () => {
    const s = await setup();
    const responses = await Promise.all([s.authorize(), s.authorize()]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect((await s.store.get(s.request.id))?.agentCardId).toBe("oi_1");
  });

  it("refuses a different intent after an authorization won", async () => {
    const s = await setup();
    await s.authorize();
    expect((await s.authorize("oi_other")).status).toBe(409);
    expect(s.calls).toHaveLength(1);
  });

  it("will not revive a denied or expired request", async () => {
    for (const status of ["denied", "expired"] as const) {
      const s = await setup();
      await s.store.update(s.request.id, { status });
      expect((await s.authorize()).status).toBe(409);
      expect(s.calls).toHaveLength(0);
    }
  });

  it("checks request ownership before contacting Crossmint", async () => {
    const s = await setup();
    await s.store.create({ ...s.request, userId: "another-user" });
    expect((await s.authorize()).status).toBe(403);
    expect(s.calls).toHaveLength(0);
  });

  it("requires authentication", async () => {
    const s = await setup();
    const res = await call(
      s.handlers,
      "POST",
      `/v1/agent-card-requests/${s.request.id}/authorized`,
      { auth: null, body: { orderIntentId: "oi_1" } },
    );
    expect(res.status).toBe(401);
    expect(s.calls).toHaveLength(0);
  });

  it("does not accept an order intent that the buyer cannot read", async () => {
    const s = await setup();
    expect((await s.authorize("oi_missing")).status).toBe(404);
    expect((await s.store.get(s.request.id))?.status).toBe("pending");
  });

  it.each([
    ["inactive", { status: "revoked" }],
    ["expired", { expiresAt: "2000-01-01T00:00:00.000Z" }],
    ["excess lifetime", { expiresAt: "2099-01-01T00:00:00.000Z" }],
    ["description", { description: "Different purchase" }],
    ["missing merchant", { merchant: undefined }],
    ["different domain", { merchant: { ...merchant, url: "https://other.example" } }],
    ["different country", { merchant: { ...merchant, countryCode: "GB" } }],
    ["no usable rail", { rails: [] }],
    [
      "pending verification",
      { rails: [{ rail: "agentic-token", provider: "vic", status: "pending_verification" }] },
    ],
    ["different currency", { amount: { total: "50", available: "50", currency: "EUR" } }],
    ["different total", { amount: { total: "51", available: "51", currency: "USD" } }],
    ["spent funds", { amount: { total: "50", available: "49", currency: "USD" } }],
  ])("rejects %s", async (_label, override) => {
    const s = await setup(override);
    expect((await s.authorize()).status).toBe(409);
    expect((await s.store.get(s.request.id))?.status).toBe("pending");
  });

  it("compares amounts as decimals rather than strings", async () => {
    const s = await setup({ amount: { total: "050.0000", available: "50", currency: "usd" } });
    expect((await s.authorize()).status).toBe(200);
  });

  it("rejects authorization if denial wins while Crossmint is being read", async () => {
    const s = await setup();
    const transition = s.store.transition.bind(s.store);
    vi.spyOn(s.store, "transition").mockImplementationOnce(async (id, from, patch) => {
      await transition(id, ["pending"], { status: "denied" });
      return transition(id, from, patch);
    });
    expect((await s.authorize()).status).toBe(409);
    expect((await s.store.get(s.request.id))?.status).toBe("denied");
  });

  it("expires a request before association", async () => {
    const s = await setup();
    await s.store.create({ ...s.request, requestExpiresAt: "2000-01-01T00:00:00.000Z" });
    expect((await s.authorize()).status).toBe(409);
    expect((await s.store.get(s.request.id))?.status).toBe("expired");
    expect(s.calls).toHaveLength(0);
  });

  it("removes the old server-side creation endpoint", async () => {
    const s = await setup();
    expect(
      (
        await call(s.handlers, "POST", `/v1/agent-card-requests/${s.request.id}/approve`, {
          body: { paymentMethodId: "pm_1" },
        })
      ).status,
    ).toBe(404);
    expect(s.calls).toHaveLength(0);
  });
});
