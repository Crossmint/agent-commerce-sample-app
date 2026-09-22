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
      name: "Agent Commerce",
      apiBaseUrl: "https://wallet.test/api/agent-commerce",
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
    const b = await handlers.GET(new Request("https://wallet.test/api/agent-commerce/health"));
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

  it("approve again with another card revokes the first one, while verification is still open", async () => {
    const pending = activeOrderIntent({
      rails: [{ rail: "agentic-token", provider: "vic", status: "pending_verification" }],
    });
    const { handlers, calls } = makeServer([
      {
        method: "PUT",
        path: "/order-intent-registration",
        reply: { body: { paymentMethodId: "pm_1", rails: [] } },
      },
      {
        method: "POST",
        path: "/unstable/order-intents",
        reply: { status: 201, body: pending },
        once: true,
      },
      { method: "DELETE", path: "/unstable/order-intents/oi_1", reply: { status: 204 } },
      {
        method: "POST",
        path: "/unstable/order-intents",
        reply: {
          status: 201,
          body: activeOrderIntent({ orderIntentId: "oi_2", paymentMethodId: "pm_2" }),
        },
      },
    ]);
    const created = await (
      await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody })
    ).json();
    const first = await (
      await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
        body: { paymentMethodId: "pm_1" },
      })
    ).json();
    expect(first.request.status).toBe("approved");

    // The bank would not confirm, so the user picks another card.
    const second = await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
      body: { paymentMethodId: "pm_2" },
    });
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.request).toMatchObject({
      status: "active",
      agentCardId: "oi_2",
      paymentMethodId: "pm_2",
    });
    expect(
      calls.some((c) => c.method === "DELETE" && c.path.endsWith("/unstable/order-intents/oi_1")),
    ).toBe(true);
  });

  it("approve again is refused once the card is active", async () => {
    const { handlers } = makeServer([
      {
        method: "PUT",
        path: "/order-intent-registration",
        reply: { body: { paymentMethodId: "pm_1", rails: [] } },
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
    await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
      body: { paymentMethodId: "pm_1" },
    });
    const again = await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
      body: { paymentMethodId: "pm_2" },
    });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("invalid_request");
  });

  it("deny during verification revokes the card that was made", async () => {
    const pending = activeOrderIntent({
      rails: [{ rail: "agentic-token", provider: "vic", status: "pending_verification" }],
    });
    const { handlers, calls } = makeServer([
      {
        method: "PUT",
        path: "/order-intent-registration",
        reply: { body: { paymentMethodId: "pm_1", rails: [] } },
      },
      { method: "POST", path: "/unstable/order-intents", reply: { status: 201, body: pending } },
      { method: "DELETE", path: "/unstable/order-intents/oi_1", reply: { status: 204 } },
    ]);
    const created = await (
      await call(handlers, "POST", "/v1/agent-card-requests", { body: requestBody })
    ).json();
    await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/approve`, {
      body: { paymentMethodId: "pm_1" },
    });
    const denied = await (
      await call(handlers, "POST", `/v1/agent-card-requests/${created.id}/deny`)
    ).json();
    expect(denied.status).toBe("denied");
    expect(
      calls.some((c) => c.method === "DELETE" && c.path.endsWith("/unstable/order-intents/oi_1")),
    ).toBe(true);
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
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", {
      body: { merchant },
    });
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
  const run = (over: Record<string, unknown>) => ({
    runId: "run_1",
    revision: 1,
    createdAt: "2026-09-17T00:00:00.000Z",
    input: {
      request: { startUrl: "https://www.shop.example/products/tee", task: "medium, black" },
      constraints: { maxCost: { amount: "30.00", currency: "USD" } },
    },
    browser: null,
    requiredAction: null,
    ...over,
  });
  const paymentRequest = {
    type: "input_response",
    requestId: "req_pay",
    messageId: "msg_pay",
    request: {
      question: "Enter the card to pay with",
      expiresAt: "2026-09-18T00:00:00.000Z",
      interaction: {
        kind: "form",
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
        uiSchema: {},
      },
    },
  };

  it("creates with the server key, Crossmint's request shape, and links the agent card", async () => {
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: {
          status: 202,
          body: run({
            status: "running",
            browser: { embedUrl: "/embed/run_1", permissions: ["read"] },
          }),
        },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/checkouts", {
      body: {
        startUrl: "https://shop.example/p/1",
        task: "medium, black",
        agentCardId: "oi_1",
        maxCost: { amount: "100.00", currency: "USD" },
        buyerProfileId: "bp_1",
      },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: "run_1",
      status: "running",
      agentCardId: "oi_1",
      embedUrl: "https://www.crossmint.com/embed/run_1",
      createdAt: "2026-09-17T00:00:00.000Z",
    });
    const create = calls[0]!;
    expect(create.url).toBe("https://www.crossmint.com/api/unstable/agent-checkouts");
    expect(create.headers).toMatchObject({
      "X-API-KEY": "sk_test",
      "x-crossmint-user-id": "user-test-1",
    });
    expect(create.body).toEqual({
      request: { startUrl: "https://shop.example/p/1", task: "medium, black" },
      constraints: { maxCost: { amount: "100.00", currency: "USD" } },
      buyerProfileId: "bp_1",
    });
  });

  it("still accepts the older url and request field names", async () => {
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ status: "queued" }) },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/checkouts", {
      body: {
        url: "https://shop.example/p/1",
        request: "blue",
        agentCardId: "oi_1",
        maxCost: { amount: "5.00", currency: "USD" },
      },
    });
    expect(res.status).toBe(201);
    expect(calls[0]!.body).toMatchObject({
      request: { startUrl: "https://shop.example/p/1", task: "blue" },
    });
  });

  it("raises a payment step when nothing pays for the run yet, and reuses it across polls", async () => {
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_1",
        reply: { body: run({ status: "awaiting_input", requiredAction: paymentRequest }) },
      },
    ]);
    // No agentCardId: the ordinary case, where the user just asked to buy something.
    await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", maxCost: { amount: "30.00", currency: "USD" } },
    });

    const res = await call(handlers, "GET", "/v1/checkouts/run_1");
    expect(res.status).toBe(200);
    const body = await res.json();
    // The run stays open and the step is the view, rather than a 409.
    expect(body.status).toBe("awaiting_input");
    expect(body.paymentRequest).toMatchObject({
      status: "pending",
      amount: { value: "30.00", currency: "USD" },
      merchant: { name: "shop.example" },
    });
    expect(body.paymentRequest.approvalUrl).toBe(
      `https://wallet.test/approve/${body.paymentRequest.requestId}`,
    );
    // Never the store's own card form.
    expect(body.rendered).toBeUndefined();
    expect(body.pendingUserAction).toBeUndefined();
    // Nothing was minted: there is no card yet.
    expect(calls.some((c) => c.path.endsWith("/credentials"))).toBe(false);

    const again = await (await call(handlers, "GET", "/v1/checkouts/run_1")).json();
    expect(again.paymentRequest.requestId).toBe(body.paymentRequest.requestId);
  });

  // Its own run id: the server remembers answered payment requests per run, in
  // module state, so two tests that answer the same run would tread on each other.
  it("pays from the agent card the payment step minted, once the user has chosen", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ runId: "run_9", status: "queued" }) },
      },
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
      // Anchored: "/unstable/order-intents" also matches the credentials path.
      {
        method: "POST",
        path: /\/unstable\/order-intents$/,
        reply: { status: 201, body: activeOrderIntent() },
      },
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/order-intents/oi_1/credentials",
        reply: { status: 201, body: cardCredential },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_9",
        once: true,
        reply: {
          body: run({ runId: "run_9", status: "awaiting_input", requiredAction: paymentRequest }),
        },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_9",
        once: true,
        reply: {
          body: run({ runId: "run_9", status: "awaiting_input", requiredAction: paymentRequest }),
        },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_9/messages",
        reply: { status: 202, body: { messageId: "m_1", status: "accepted" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_9",
        reply: {
          body: run({
            runId: "run_9",
            status: "succeeded",
            result: { outcome: "succeeded", summary: "Bought the tee." },
          }),
        },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", maxCost: { amount: "30.00", currency: "USD" } },
    });
    const step = (await (await call(handlers, "GET", "/v1/checkouts/run_9")).json()).paymentRequest;

    // The user picks a payment method on the very same request.
    const approved = await call(
      handlers,
      "POST",
      `/v1/agent-card-requests/${step.requestId}/approve`,
      {
        body: { paymentMethodId: "pm_1" },
      },
    );
    expect((await approved.json()).request.status).toBe("active");

    const done = await (await call(handlers, "GET", "/v1/checkouts/run_9")).json();
    expect(done.status).toBe("succeeded");
    expect(done.agentCardId).toBe("oi_1");
    expect(done.paymentRequest).toBeUndefined();

    // The card was scoped to the run: its max cost, locked to the store.
    const mint = calls.find((c) => c.path.endsWith("/credentials"))!;
    expect(mint.body).toMatchObject({
      amount: { value: "30.00", currency: "USD" },
      merchant: { name: "shop.example" },
    });
    const message = calls.find((c) => c.path.endsWith("/run_9/messages"))!;
    expect(message.body).toMatchObject({
      parts: [{ type: "input_response", requestId: "req_pay", action: "submit" }],
    });
  });

  it("answers a payment request with a minted card and hides it from the caller", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_1",
        once: true,
        reply: { body: run({ status: "awaiting_input", requiredAction: paymentRequest }) },
      },
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/order-intents/oi_1/credentials",
        reply: { status: 201, body: cardCredential },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_1/messages",
        reply: { status: 202, body: { messageId: "m_1", status: "accepted" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_1",
        reply: {
          body: run({
            status: "succeeded",
            result: {
              outcome: "succeeded",
              summary: "Bought the tee.",
              purchase: {
                kind: "receipt_captured",
                receipt: { total: { amount: "28.00", currency: "USD" }, merchantOrderId: "ord_9" },
              },
            },
            knownSpentUsdMicros: 28_000_000,
          }),
        },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: {
        startUrl: "https://shop.example/p/1",
        agentCardId: "oi_1",
        maxCost: { amount: "30.00", currency: "USD" },
      },
    });

    const res = await call(handlers, "GET", "/v1/checkouts/run_1");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("4111111111111111");
    expect(JSON.parse(text)).toEqual({
      id: "run_1",
      status: "succeeded",
      agentCardId: "oi_1",
      result: {
        outcome: "succeeded",
        summary: "Bought the tee.",
        purchase: {
          kind: "receipt_captured",
          receipt: { total: { amount: "28.00", currency: "USD" }, merchantOrderId: "ord_9" },
        },
      },
      receipt: { total: { amount: "28.00", currency: "USD" }, merchantOrderId: "ord_9" },
      spentUsd: "28.00",
      createdAt: "2026-09-17T00:00:00.000Z",
    });

    const mint = calls.find((c) => c.path.endsWith("/credentials"))!;
    // Capped at the checkout's max cost, below the card's 50.00.
    expect(mint.body).toMatchObject({
      amount: { value: "30.00", currency: "USD" },
      merchant: { name: "shop.example" },
    });
    const message = calls.find((c) => c.path.endsWith("/run_1/messages"))!;
    expect(message.body).toMatchObject({
      parts: [
        {
          type: "input_response",
          requestId: "req_pay",
          action: "submit",
          response: {
            kind: "form",
            values: {
              cardNumber: "4111111111111111",
              expirationMonth: "12",
              expirationYear: "2030",
              cvc: "123",
            },
          },
        },
      ],
    });
    expect(typeof (message.body as { id: string }).id).toBe("string");
    vi.restoreAllMocks();
  });

  it("passes other input requests through with a rendered form and relays the answer as a message", async () => {
    let answered = false;
    const sizeRequest = {
      type: "input_response",
      requestId: "req_size",
      messageId: "msg_size",
      request: {
        question: "Which size?",
        expiresAt: "2026-09-18T00:00:00.000Z",
        interaction: {
          kind: "form",
          responseSchema: {
            type: "object",
            properties: { size: { type: "string", enum: ["s", "m"] } },
            required: ["size"],
          },
          uiSchema: {},
        },
      },
    };
    const { handlers, calls } = makeServer([
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_2",
        reply: () => ({
          body: run({
            runId: "run_2",
            status: answered ? "running" : "awaiting_input",
            requiredAction: answered ? null : sizeRequest,
          }),
        }),
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_2/messages",
        reply: () => {
          answered = true;
          return { status: 202, body: { messageId: "m_2", status: "accepted" } };
        },
      },
    ]);
    const res = await call(handlers, "GET", "/v1/checkouts/run_2");
    const body = await res.json();
    expect(body.status).toBe("awaiting_input");
    expect(body.pendingUserAction).toMatchObject({ id: "req_size", question: "Which size?" });
    expect(body.rendered.title).toBe("Which size?");
    expect(body.rendered.fields[0]).toMatchObject({ name: "size", kind: "select", required: true });

    const reply = await call(handlers, "POST", "/v1/checkouts/run_2/messages", {
      body: { requestId: "req_size", values: { size: "m" }, messageId: "client-1" },
    });
    expect((await reply.json()).status).toBe("running");
    const sent = calls.find((c) => c.path.endsWith("/run_2/messages"))!;
    expect(sent.body).toEqual({
      id: "client-1",
      parts: [
        {
          type: "input_response",
          requestId: "req_size",
          action: "submit",
          response: { kind: "form", values: { size: "m" } },
        },
      ],
    });
  });

  it("refuses card fields from callers and maps blocked runs to a failure", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_3",
        once: true,
        reply: {
          body: run({ runId: "run_3", status: "awaiting_input", requiredAction: paymentRequest }),
        },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_3",
        reply: {
          body: run({
            runId: "run_3",
            status: "blocked",
            result: {
              outcome: "blocked",
              code: "policy.max_cost_exceeded",
              summary: "The total was 31.00, above the 30.00 cap.",
            },
          }),
        },
      },
    ]);
    const refused = await call(handlers, "POST", "/v1/checkouts/run_3/messages", {
      body: { requestId: "req_pay", values: { cardNumber: "4242" } },
    });
    expect(refused.status).toBe(409);
    expect((await refused.json()).error.code).toBe("payment_handled_by_server");

    const res = await call(handlers, "GET", "/v1/checkouts/run_3");
    const body = await res.json();
    expect(body.status).toBe("blocked");
    expect(body.failure).toEqual({
      reason: "policy.max_cost_exceeded",
      message: "The total was 31.00, above the 30.00 cap.",
    });
  });
});

describe("GET /v1/reveals", () => {
  it("records a line when a credential is minted, and never the card details", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { handlers } = makeServer([
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/order-intents/oi_1/credentials",
        reply: { status: 201, body: cardCredential },
      },
    ]);
    const merchant = { name: "Shop", url: "https://shop.example", countryCode: "US" };
    await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", { body: { merchant } });

    const res = await call(handlers, "GET", "/v1/reveals");
    expect(res.status).toBe(200);
    const { reveals } = await res.json();
    expect(reveals).toHaveLength(1);
    expect(reveals[0]).toMatchObject({
      userId: "user-test-1",
      agentCardId: "oi_1",
      paymentMethodId: "pm_1",
      description: "Flight to SF",
      amount: { value: "50.00", currency: "USD" },
      merchant,
      rail: "agentic-token",
      provider: "vic",
      enforced: true,
    });
    // The row is an audit line, not a copy of the credential. "123" is too
    // short to assert on — a generated id can contain it — so this checks the
    // shape instead: nothing from the credential is carried over.
    expect(JSON.stringify(reveals)).not.toContain("4111111111111111");
    expect(reveals[0]).not.toHaveProperty("card");
    expect(reveals[0]).not.toHaveProperty("token");
  });

  it("is empty for a user who has minted nothing, and needs a token", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "GET", "/v1/reveals");
    expect(await res.json()).toEqual({ reveals: [] });

    const anon = await call(handlers, "GET", "/v1/reveals", { auth: null });
    expect(anon.status).toBe(401);
  });
});
