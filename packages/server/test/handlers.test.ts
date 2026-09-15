import { describe, expect, it, vi } from "vitest";
import { activeOrderIntent, call, cardCredential, makeServer } from "./helpers.js";

describe("auth", () => {
  it("rejects a missing bearer token", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "GET", "/v1/me", { auth: null });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("rejects a bad token", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "GET", "/v1/me", { auth: "bad" });
    expect(res.status).toBe(401);
  });

  it("returns the user for a good token", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "GET", "/v1/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user-test-1", email: "a@b.c" });
  });
});

describe("GET /v1/config", () => {
  it("needs no auth and describes the Stytch OAuth server", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "GET", "/v1/config", { auth: null });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      name: "GOAT",
      apiBaseUrl: "https://wallet.test/api/goat",
      webBaseUrl: "https://wallet.test",
      crossmintEnvironment: "staging",
      auth: {
        provider: "stytch",
        projectId: "project-test-123",
        environment: "test",
        oauth: {
          authorizationEndpoint: "https://wallet.test/oauth/authorize",
          tokenEndpoint: "https://test.stytch.com/v1/public/project-test-123/oauth2/token",
          cliClientId: "connected-app-cli",
          scopes: ["openid", "email", "profile", "offline_access", "full_access"],
        },
      },
    });
  });
});

describe("router", () => {
  it("404s unknown routes and paths without /v1/", async () => {
    const { handlers } = makeServer();
    const a = await call(handlers, "GET", "/v1/nope");
    expect(a.status).toBe(404);
    const b = await handlers.GET(new Request("https://wallet.test/api/goat/health"));
    expect(b.status).toBe(404);
  });

  it("405s a known path with the wrong method", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "DELETE", "/v1/me");
    expect(res.status).toBe(405);
  });
});

describe("agent card requests", () => {
  const requestBody = {
    amount: { value: "50.00", currency: "USD" },
    description: "Flight to SF",
    expiresInHours: 24,
    requester: "Claude Code",
  };

  it("creates a pending request with an approval url", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^acr_[A-Za-z0-9_-]{21}$/);
    expect(body).toMatchObject({
      userId: "user-test-1",
      requester: "Claude Code",
      amount: { value: "50.00", currency: "USD" },
      description: "Flight to SF",
      status: "pending",
      approvalUrl: `https://wallet.test/approve/${body.id}`,
    });
    expect(Date.parse(body.requestExpiresAt) - Date.parse(body.createdAt)).toBeCloseTo(
      15 * 60_000,
      -3,
    );
    expect(Date.parse(body.expiresAt) - Date.parse(body.createdAt)).toBeCloseTo(24 * 3_600_000, -3);

    const got = await call(handlers, "GET", `/v1/agent-card-requests/${body.id}`);
    expect(got.status).toBe(200);
    expect((await got.json()).status).toBe("pending");
  });

  it("rejects an invalid body", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "POST", "/v1/agent-card-requests", {
      body: { amount: { value: "abc", currency: "USD" }, description: "" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.details.issues.length).toBeGreaterThan(0);
  });

  it("returns a pending request past its window as expired", async () => {
    const { handlers } = makeServer([], { requestTtlMinutes: 0 });
    const created = await (
      await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody })
    ).json();
    const got = await (await call(handlers, "GET", `/v1/agent-card-requests/${created.id}`)).json();
    expect(got.status).toBe("expired");
    const approve = await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
      body: { paymentMethodId: "pm_1" },
    });
    expect(approve.status).toBe(409);
    expect((await approve.json()).error.code).toBe("expired");
  });

  it("approve registers the card, creates the order intent, and goes active", async () => {
    const { handlers, calls } = makeServer([
      {
        method: "PUT",
        path: "/order-intent-registration",
        reply: {
          body: {
            paymentMethodId: "pm_1",
            rails: [{ rail: "agentic-token", provider: "vic", status: "enabled" }],
          },
        },
      },
      {
        method: "POST",
        path: "/unstable/order-intents",
        reply: { status: 201, body: activeOrderIntent() },
      },
    ]);
    const created = await (
      await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody })
    ).json();

    const res = await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
      body: { paymentMethodId: "pm_1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request).toMatchObject({
      status: "active",
      agentCardId: "oi_1",
      paymentMethodId: "pm_1",
    });
    expect(body.agentCard.orderIntentId).toBe("oi_1");
    expect(body.needsVerification).toBe(false);

    const reg = calls.find((c) => c.method === "PUT")!;
    expect(reg.path).toContain("/unstable/payment-methods/pm_1/order-intent-registration");
    expect(reg.body).toEqual({ email: "a@b.c", countryCode: "US" });
    expect(reg.headers).toMatchObject({ "X-API-KEY": "ck_test", Authorization: "Bearer good" });

    const create = calls.find((c) => c.method === "POST")!;
    expect(create.body).toEqual({
      paymentMethodId: "pm_1",
      amount: { value: "50.00", currency: "USD" },
      description: "Flight to SF",
      expiresAt: created.expiresAt,
    });

    // The agent's next poll sees it.
    const polled = await (
      await call(handlers, "GET", `/v1/agent-card-requests/${created.id}`)
    ).json();
    expect(polled.status).toBe("active");
  });

  it("approve stays approved when the rail needs verification, then verified flips it", async () => {
    const pending = activeOrderIntent({
      rails: [{ rail: "agentic-token", provider: "vic", status: "pending_verification" }],
    });
    const { handlers } = makeServer([
      {
        method: "PUT",
        path: "/order-intent-registration",
        reply: { body: { paymentMethodId: "pm_1", rails: [] } },
      },
      { method: "POST", path: "/unstable/order-intents", reply: { status: 201, body: pending } },
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
    ]);
    const created = await (
      await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody })
    ).json();
    const approved = await (
      await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
        body: { paymentMethodId: "pm_1" },
      })
    ).json();
    expect(approved.request.status).toBe("approved");
    expect(approved.needsVerification).toBe(true);

    const verified = await (
      await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/verified`)
    ).json();
    expect(verified.request.status).toBe("active");
    expect(verified.agentCard.orderIntentId).toBe("oi_1");
  });

  it("deny marks the request denied", async () => {
    const { handlers } = makeServer();
    const created = await (
      await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody })
    ).json();
    const res = await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/deny`);
    expect((await res.json()).status).toBe("denied");
  });

  it("maps Crossmint failures to crossmint_error with details", async () => {
    const { handlers } = makeServer([
      {
        method: "PUT",
        path: "/order-intent-registration",
        reply: { body: { paymentMethodId: "pm_1", rails: [] } },
      },
      {
        method: "POST",
        path: "/unstable/order-intents",
        reply: { status: 500, body: { message: "boom" } },
      },
    ]);
    const created = await (
      await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody })
    ).json();
    const res = await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
      body: { paymentMethodId: "pm_1" },
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatchObject({
      code: "crossmint_error",
      message: "boom",
      details: { status: 500, body: { message: "boom" } },
    });
  });

  it("maps a Crossmint 401 to unauthorized", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/order-intents",
        reply: { status: 401, body: { message: "bad jwt" } },
      },
    ]);
    const res = await call(handlers, "GET", "/v1/agent-cards");
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });
});

describe("POST /v1/agent-cards/:id/credentials", () => {
  it("returns 400 merchant_required when the card is open and no merchant is given", async () => {
    const { handlers } = makeServer([
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
    ]);
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", { body: {} });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("merchant_required");
  });

  it("mints a card from the agentic-token rail for the full available amount", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { handlers, calls } = makeServer([
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/order-intents/oi_1/credentials",
        reply: { status: 201, body: cardCredential },
      },
    ]);
    const merchant = { name: "Shop", url: "https://shop.example", countryCode: "US" };
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", { body: { merchant } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      agentCardId: "oi_1",
      rail: "agentic-token",
      provider: "vic",
      enforced: true,
      card: {
        number: "4111111111111111",
        expirationMonth: "12",
        expirationYear: "2030",
        cvc: "123",
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const mint = calls.find((c) => c.method === "POST")!;
    expect(mint.body).toEqual({
      rail: "agentic-token",
      provider: "vic",
      amount: { value: "50.00", currency: "USD" },
      credential: { format: "card" },
      merchant,
    });
    // Logged, but never the PAN.
    expect(info).toHaveBeenCalled();
    expect(JSON.stringify(info.mock.calls)).not.toContain("4111111111111111");
    info.mockRestore();
  });

  it("passes amount and merchant through when the order intent has no merchant", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { handlers, calls } = makeServer([
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      { method: "POST", path: "/credentials", reply: { status: 201, body: cardCredential } },
    ]);
    const merchant = { name: "United", url: "https://united.com", countryCode: "US" };
    await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", {
      body: { amount: { value: "25.00", currency: "USD" }, merchant },
    });
    const mint = calls.find((c) => c.method === "POST")!;
    expect(mint.body).toMatchObject({ amount: { value: "25.00", currency: "USD" }, merchant });
    vi.restoreAllMocks();
  });

  it("returns 409 verification_required when the only card rail is pending", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/order-intents/oi_1",
        reply: {
          body: activeOrderIntent({
            rails: [
              { rail: "agentic-token", provider: "vic", status: "pending_verification" },
              { rail: "spt", provider: "stripe", status: "active" },
            ],
          }),
        },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", { body: {} });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("verification_required");
  });

  it("returns 409 no_usable_rail when no rail is active", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/order-intents/oi_1",
        reply: {
          body: activeOrderIntent({
            rails: [{ rail: "agentic-token", provider: "vic", status: "error" }],
          }),
        },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", { body: {} });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("no_usable_rail");
  });

  it("skips the encrypted-card rail when no private key is configured", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/order-intents/oi_1",
        reply: {
          body: activeOrderIntent({ rails: [{ rail: "encrypted-card", status: "active" }] }),
        },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", { body: {} });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("no_usable_rail");
  });
});

describe("checkouts", () => {
  const paymentAction = {
    id: "act_pay",
    type: "payment",
    title: "Enter card",
    responseSchema: {
      type: "object",
      properties: {
        cardNumber: { type: "string" },
        expirationMonth: { type: "string" },
        expirationYear: { type: "string" },
        cvc: { type: "string" },
      },
      required: ["cardNumber", "expirationMonth", "expirationYear", "cvc"],
    },
  };

  it("creates with the server key and links the agent card", async () => {
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: "/unstable/agent-checkouts",
        reply: {
          status: 201,
          body: { id: "co_1", status: "running", browser: { embedUrl: "/embed/co_1" } },
        },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/checkouts", {
      body: {
        url: "https://shop.example/p/1",
        request: "medium, black",
        agentCardId: "oi_1",
        maxCost: { amount: "100.00", currency: "USD" },
      },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: "co_1",
      status: "running",
      agentCardId: "oi_1",
      embedUrl: "https://www.crossmint.com/embed/co_1",
    });
    const create = calls[0]!;
    expect(create.url).toBe("https://www.crossmint.com/api/unstable/agent-checkouts");
    expect(create.headers).toMatchObject({
      "X-API-KEY": "sk_test",
      "x-crossmint-user-id": "user-test-1",
    });
    expect(create.body).toEqual({
      target: { kind: "direct_url", url: "https://shop.example/p/1", request: "medium, black" },
      constraints: { maxCost: { amount: "100.00", currency: "USD" } },
    });
  });

  it("answers a payment action with a minted card and hides it from the caller", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: "/unstable/agent-checkouts",
        reply: { status: 201, body: { id: "co_1", status: "running" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/co_1",
        once: true,
        reply: {
          body: {
            id: "co_1",
            status: "awaiting_user_action",
            target: { kind: "direct_url", url: "https://www.shop.example/products/tee" },
            constraints: { maxCost: { amount: "30.00", currency: "USD" } },
            pendingUserAction: paymentAction,
          },
        },
      },
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/order-intents/oi_1/credentials",
        reply: { status: 201, body: cardCredential },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/co_1/actions/act_pay",
        reply: { body: { id: "co_1", status: "running" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/co_1",
        reply: { body: { id: "co_1", status: "succeeded", receipt: { merchantOrderId: "ord_9" } } },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: {
        url: "https://shop.example/p/1",
        agentCardId: "oi_1",
        maxCost: { amount: "30.00", currency: "USD" },
      },
    });

    const res = await call(handlers, "GET", "/v1/checkouts/co_1");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("4111111111111111");
    expect(JSON.parse(text)).toEqual({
      id: "co_1",
      status: "succeeded",
      agentCardId: "oi_1",
      receipt: { merchantOrderId: "ord_9" },
    });

    const mint = calls.find((c) => c.path.endsWith("/credentials"))!;
    // Capped at the checkout's max cost, below the card's 50.00.
    expect(mint.body).toMatchObject({ amount: { value: "30.00", currency: "USD" } });
    const submit = calls.find((c) => c.path.endsWith("/actions/act_pay"))!;
    expect(submit.body).toEqual({
      action: "submit",
      values: {
        cardNumber: "4111111111111111",
        expirationMonth: "12",
        expirationYear: "2030",
        cvc: "123",
      },
    });
    vi.restoreAllMocks();
  });

  it("passes non-payment actions through with a rendered form", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/agent-checkouts/co_2",
        reply: {
          body: {
            id: "co_2",
            status: "awaiting_user_action",
            pendingUserAction: {
              id: "act_size",
              type: "options",
              responseSchema: {
                type: "object",
                properties: { size: { type: "string", enum: ["s", "m"] } },
                required: ["size"],
              },
            },
          },
        },
      },
      {
        method: "POST",
        path: "/actions/act_size",
        reply: { body: { id: "co_2", status: "running" } },
      },
    ]);
    const res = await call(handlers, "GET", "/v1/checkouts/co_2");
    const body = await res.json();
    expect(body.status).toBe("awaiting_user_action");
    expect(body.pendingUserAction.id).toBe("act_size");
    expect(body.rendered.fields[0]).toMatchObject({ name: "size", kind: "select", required: true });

    const answered = await call(handlers, "POST", "/v1/checkouts/co_2/actions/act_size", {
      body: { values: { size: "m" } },
    });
    expect((await answered.json()).status).toBe("running");
  });
});
