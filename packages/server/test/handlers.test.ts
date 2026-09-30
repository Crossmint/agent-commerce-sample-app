import { describe, expect, it, vi } from "vitest";
import {
  BROWSER_PROFILE_ID,
  activeOrderIntent,
  call,
  cardCredential,
  findCall,
  makeServer,
  type FakeCall,
} from "./helpers.js";

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

  it("returns 409 cvc_recollection_required when the rail wants the security code", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/order-intents/oi_1",
        reply: {
          body: activeOrderIntent({
            rails: [{ rail: "encrypted-card", status: "pending_cvc_recollection" }],
          }),
        },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", { body: {} });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("cvc_recollection_required");
    // The wallet's field is keyed by the saved card, so the caller is told which.
    expect(body.error.details.paymentMethodId).toBe("pm_1");
  });

  it("mints from the live rail when only the unused fallback wants the code", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/order-intents/oi_1",
        reply: {
          body: activeOrderIntent({
            rails: [
              { rail: "agentic-token", provider: "vic", status: "active", credentialFormats: ["card"] },
              { rail: "encrypted-card", status: "pending_cvc_recollection" },
            ],
          }),
        },
      },
      { method: "POST", path: "/credentials", reply: { status: 201, body: cardCredential } },
    ]);
    // The network rail issues per merchant, and this order intent names none.
    const merchant = { name: "United", url: "https://united.com", countryCode: "US" };
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", {
      body: { merchant },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).rail).toBe("agentic-token");
  });

  it("turns Crossmint's CVC 409 on the mint into cvc_recollection_required", async () => {
    const { handlers } = makeServer([
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/credentials",
        reply: {
          status: 409,
          body: {
            code: "ORDER_INTENT_CVC_RECOLLECTION_REQUIRED",
            message: "The vaulted CVC expired",
          },
        },
      },
    ]);
    const merchant = { name: "United", url: "https://united.com", countryCode: "US" };
    const res = await call(handlers, "POST", "/v1/agent-cards/oi_1/credentials", {
      body: { merchant },
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("cvc_recollection_required");
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
  // The payment step as Agent Checkouts sends it: what to authorize, and where.
  const paymentRequest = {
    type: "input_response",
    requestId: "req_pay",
    messageId: "msg_pay",
    request: {
      question: "Authorize a card payment of 28.40 USD at shop.example.",
      expiresAt: "2026-09-18T00:00:00.000Z",
      interaction: {
        kind: "payment",
        purpose: "checkout_payment",
        method: "card",
        amount: { kind: "exact", value: "28.40", currency: "USD" },
        merchant: { domain: "shop.example" },
      },
    },
  };
  const paidWith = (orderIntentId: string, requestId = "req_pay") => ({
    parts: [
      {
        type: "input_response",
        requestId,
        action: "submit",
        response: { kind: "payment", orderIntentId },
      },
    ],
  });

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
      startUrl: "https://www.shop.example/products/tee",
      maxCost: { amount: "30.00", currency: "USD" },
      agentCardId: "oi_1",
      embedUrl: "https://www.crossmint.com/embed/run_1",
      createdAt: "2026-09-17T00:00:00.000Z",
    });
    const create = findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!;
    expect(create.url).toBe("https://www.crossmint.com/api/unstable/agent-checkouts");
    expect(create.headers).toMatchObject({
      "X-API-KEY": "sk_test",
      "x-crossmint-user-id": "user-test-1",
    });
    expect(create.body).toEqual({
      request: { startUrl: "https://shop.example/p/1", task: "medium, black" },
      constraints: { maxCost: { amount: "100.00", currency: "USD" } },
      buyerProfileId: "bp_1",
      // Attached by the server: the run picks up where the user's last one
      // left off, signed in to the stores they signed into before.
      browserProfileId: BROWSER_PROFILE_ID,
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
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
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
    // For the exact amount the run asks for, not the max cost, and not
    // locked to a merchant: the checkout binds the credential itself.
    expect(body.paymentRequest).toMatchObject({
      status: "pending",
      amount: { value: "28.40", currency: "USD" },
    });
    expect(body.paymentRequest.merchant).toBeUndefined();
    // Short and plain, not the run's task.
    expect(body.paymentRequest.description).toBe("Purchase at shop.example");
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
  it("names the payment step's agent card with the purpose the checkout was given", async () => {
    const { handlers } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ runId: "run_named", status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_named",
        reply: { body: run({ runId: "run_named", status: "awaiting_input", requiredAction: paymentRequest }) },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: {
        startUrl: "https://shop.example/p/1",
        task: "Buy the blue one. Use the saved buyer details. The buyer's email is ada@example.com.",
        purpose: "Blue Pikachu erasable pen",
        maxCost: { amount: "30.00", currency: "USD" },
      },
    });
    const view = await (await call(handlers, "GET", "/v1/checkouts/run_named")).json();
    expect(view.paymentRequest.description).toBe("Blue Pikachu erasable pen");
  });

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

    // The order intent as Agent Checkouts wants it: the exact amount, no
    // merchant, and only for the rest of the checkout.
    const created = findCall(calls, "POST", /\/unstable\/order-intents$/)!;
    const intent = created.body as { amount: unknown; merchant?: unknown; expiresAt: string };
    expect(intent.amount).toEqual({ value: "28.40", currency: "USD" });
    expect(intent.merchant).toBeUndefined();
    const hours = (Date.parse(intent.expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(1.5);
    expect(hours).toBeLessThan(2.5);
    // Answered with the order intent's id, never a card.
    expect(calls.some((c) => c.path.endsWith("/credentials"))).toBe(false);
    const message = calls.find((c) => c.path.endsWith("/run_9/messages"))!;
    expect(message.body).toMatchObject(paidWith("oi_1"));
  });

  it("answers the payment step with the agent card it was given, and hides the step from the caller", async () => {
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
      startUrl: "https://www.shop.example/products/tee",
      maxCost: { amount: "30.00", currency: "USD" },
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

    // No card is minted: Agent Checkouts mints the credential from the order intent itself.
    expect(calls.some((c) => c.path.endsWith("/credentials"))).toBe(false);
    const message = calls.find((c) => c.path.endsWith("/run_1/messages"))!;
    expect(message.body).toMatchObject(paidWith("oi_1"));
    expect(typeof (message.body as { id: string }).id).toBe("string");
    vi.restoreAllMocks();
  });

  const maxCost = { amount: "30.00", currency: "USD" };

  describe("the run's ceiling", () => {
    const createRoute = {
      method: "POST",
      path: /\/unstable\/agent-checkouts$/,
      reply: { status: 202, body: run({ status: "queued" }) },
    };
    const card = (available: string) => ({
      method: "GET",
      path: "/unstable/order-intents/oi_1",
      reply: {
        body: activeOrderIntent({
          amount: { currency: "USD", total: "50.00", available, reserved: "0.00", spent: "0.00" },
        }),
      },
    });
    const sentCeiling = (calls: FakeCall[]) =>
      (findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body as {
        constraints: { maxCost: unknown };
      }).constraints.maxCost;

    it("is what the agent card has left, not a higher limit", async () => {
      const { handlers, calls } = makeServer([createRoute, card("42.50")]);
      const res = await call(handlers, "POST", "/v1/checkouts", {
        body: {
          startUrl: "https://shop.example/p/1",
          agentCardId: "oi_1",
          maxCost: { amount: "100000.00", currency: "USD" },
        },
      });
      expect(res.status).toBe(201);
      expect(sentCeiling(calls)).toEqual({ amount: "42.50", currency: "USD" });
    });

    it("keeps the caller's limit when it is lower than what the card has left", async () => {
      const { handlers, calls } = makeServer([createRoute, card("42.50")]);
      await call(handlers, "POST", "/v1/checkouts", {
        body: { startUrl: "https://shop.example/p/1", agentCardId: "oi_1", maxCost },
      });
      expect(sentCeiling(calls)).toEqual({ amount: "30.00", currency: "USD" });
    });

    it("needs no maxCost: an agent card sets it, and without one the default does", async () => {
      const withCard = makeServer([createRoute, card("42.50")]);
      await call(withCard.handlers, "POST", "/v1/checkouts", {
        body: { startUrl: "https://shop.example/p/1", agentCardId: "oi_1" },
      });
      expect(sentCeiling(withCard.calls)).toEqual({ amount: "42.50", currency: "USD" });

      const without = makeServer([createRoute]);
      const res = await call(without.handlers, "POST", "/v1/checkouts", {
        body: { startUrl: "https://shop.example/p/1", currency: "eur" },
      });
      expect(res.status).toBe(201);
      expect(sentCeiling(without.calls)).toEqual({ amount: "500.00", currency: "EUR" });
    });

    it("refuses an agent card with nothing left, before the run starts", async () => {
      const { handlers, calls } = makeServer([createRoute, card("0.00")]);
      const res = await call(handlers, "POST", "/v1/checkouts", {
        body: { startUrl: "https://shop.example/p/1", agentCardId: "oi_1" },
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("agent_card_unusable");
      expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)).toBeUndefined();
    });
  });

  it("answers a payment request once, even when another instance sees it again", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const routes = [
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
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_1/messages",
        reply: { status: 202, body: { messageId: "m_1", status: "accepted" } },
      },
    ];
    const first = makeServer(routes);
    const created = await call(first.handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", agentCardId: "oi_1", maxCost },
    });
    expect(created.status).toBe(201);
    await call(first.handlers, "GET", "/v1/checkouts/run_1");
    const sent = first.calls.filter((c) => c.path.endsWith("/run_1/messages"));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toMatchObject(paidWith("oi_1"));

    // A second instance: its own memory, the same store. The request still shows open.
    const second = makeServer(routes, { store: first.store });
    const res = await call(second.handlers, "GET", "/v1/checkouts/run_1");
    expect((await res.json()).status).toBe("running");
    expect(second.calls.some((c) => c.path.endsWith("/run_1/messages"))).toBe(false);
    vi.restoreAllMocks();
  });

  it("does not hand the run an agent card whose live rails make no card", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
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
      {
        method: "GET",
        path: "/unstable/order-intents/oi_1",
        reply: {
          body: activeOrderIntent({
            rails: [
              {
                rail: "agentic-token",
                provider: "agentpay",
                status: "active",
                credentialFormats: ["network-token"],
              },
            ],
          }),
        },
      },
    ]);
    const created = await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", agentCardId: "oi_1", maxCost },
    });
    expect(created.status).toBe(201);
    const body = await (await call(handlers, "GET", "/v1/checkouts/run_1")).json();
    // Not answered: the user chooses another card at the payment step.
    expect(calls.some((c) => c.path.endsWith("/run_1/messages"))).toBe(false);
    expect(body.status).toBe("awaiting_input");
    expect(body.paymentRequest).toBeDefined();
    vi.restoreAllMocks();
  });

  it("never answers a card form with an agent card, and refuses card fields for it", async () => {
    const cardForm = {
      type: "input_response",
      requestId: "req_form",
      messageId: "msg_form",
      request: {
        question: "Enter your card details.",
        expiresAt: "2026-09-18T00:00:00.000Z",
        interaction: {
          kind: "form",
          responseSchema: {
            type: "object",
            properties: { cardNumber: { type: "string" }, cvc: { type: "string" } },
          },
        },
      },
    };
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_1",
        reply: { body: run({ status: "awaiting_input", requiredAction: cardForm }) },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_1/messages",
        reply: { status: 202, body: { messageId: "m_1", status: "accepted" } },
      },
    ]);
    const created = await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", agentCardId: "oi_1", maxCost },
    });
    expect(created.status).toBe(201);
    const body = await (await call(handlers, "GET", "/v1/checkouts/run_1")).json();
    // The agent sees the question, and no order intent was sent to it.
    expect(body.pendingUserAction.id).toBe("req_form");
    expect(calls.some((c) => c.path.endsWith("/run_1/messages"))).toBe(false);

    const refused = await call(handlers, "POST", "/v1/checkouts/run_1/messages", {
      body: { requestId: "req_form", values: { cardNumber: "4111111111111111", cvc: "123" } },
    });
    expect(refused.status).toBe(409);
    expect((await refused.json()).error.code).toBe("card_in_form");
  });

  it("passes the message stream through, resuming from the caller's cursor", async () => {
    const events =
      'id: c1\nevent: message.upsert\ndata: {"id":"m1","role":"assistant","parts":[{"type":"progress","text":"Opened the store"}]}\n\n' +
      'id: c2\nevent: run.updated\ndata: {"status":"running"}\n\n';
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_1/messages/stream",
        reply: { raw: events, contentType: "text/event-stream" },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", maxCost: { amount: "30.00", currency: "USD" } },
    });

    const res = await call(handlers, "GET", "/v1/checkouts/run_1/messages/stream?after=c0");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await res.text()).toBe(events);
    const upstream = findCall(calls, "GET", "/messages/stream")!;
    expect(upstream.url).toBe(
      "https://www.crossmint.com/api/unstable/agent-checkouts/run_1/messages/stream?after=c0",
    );
    expect(upstream.headers).toMatchObject({
      Accept: "text/event-stream",
      "X-API-KEY": "sk_test",
      "x-crossmint-user-id": "user-test-1",
    });
  });

  it("pays the payment step from an agent card the user already has", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    // A run of its own: the server remembers, per run, which payment it answered and with what.
    const payStep = { ...paymentRequest, requestId: "req_pay_existing" };
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ runId: "run_mine", status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_mine",
        once: true,
        reply: { body: run({ runId: "run_mine", status: "awaiting_input", requiredAction: payStep }) },
      },
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/order-intents/oi_1/credentials",
        reply: { status: 201, body: cardCredential },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_mine/messages",
        reply: { status: 202, body: { messageId: "m_1", status: "accepted" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_mine",
        reply: { body: run({ runId: "run_mine", status: "running" }) },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", maxCost: { amount: "30.00", currency: "USD" } },
    });

    const res = await call(handlers, "POST", "/v1/checkouts/run_mine/agent-card", {
      body: { agentCardId: "oi_1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "run_mine", status: "running", agentCardId: "oi_1" });
    expect(calls.some((c) => c.path.endsWith("/credentials"))).toBe(false);
    expect(findCall(calls, "POST", "/run_mine/messages")!.body).toMatchObject(
      paidWith("oi_1", "req_pay_existing"),
    );
    // No new agent card request: the user chose a card they had.
    expect(calls.some((c) => c.method === "POST" && c.path.includes("order-intents") && !c.path.endsWith("/credentials"))).toBe(false);
    vi.restoreAllMocks();
  });

  it("asks for a new authorization when the run turns an agent card down", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const first = { ...paymentRequest, requestId: "req_first" };
    // After the card fails (say, insufficient_allowance), the run asks again.
    const again = { ...paymentRequest, requestId: "req_again" };
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ runId: "run_retry", status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_retry",
        once: true,
        reply: { body: run({ runId: "run_retry", status: "awaiting_input", requiredAction: first }) },
      },
      { method: "GET", path: "/unstable/order-intents/oi_1", reply: { body: activeOrderIntent() } },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_retry/messages",
        reply: { status: 202, body: { messageId: "m_1", status: "accepted" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_retry",
        reply: { body: run({ runId: "run_retry", status: "awaiting_input", requiredAction: again }) },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", maxCost: { amount: "30.00", currency: "USD" } },
    });
    await call(handlers, "POST", "/v1/checkouts/run_retry/agent-card", { body: { agentCardId: "oi_1" } });
    expect(calls.filter((c) => c.path.endsWith("/run_retry/messages"))).toHaveLength(1);

    const view = await (await call(handlers, "GET", "/v1/checkouts/run_retry")).json();
    // The card that failed is not sent again; the user is asked to choose.
    expect(calls.filter((c) => c.path.endsWith("/run_retry/messages"))).toHaveLength(1);
    expect(view.paymentRequest).toMatchObject({
      status: "pending",
      amount: { value: "28.40", currency: "USD" },
    });
    vi.restoreAllMocks();
  });

  it("sends an answer and a note as two messages, one part each", async () => {
    const question = {
      type: "input_response",
      requestId: "req_size",
      messageId: "msg_size",
      request: {
        question: "Which size?",
        expiresAt: "2026-09-18T00:00:00.000Z",
        interaction: {
          kind: "form",
          responseSchema: { type: "object", properties: { size: { type: "string" } } },
        },
      },
    };
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: /\/unstable\/agent-checkouts$/,
        reply: { status: 202, body: run({ runId: "run_note", status: "queued" }) },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_note",
        once: true,
        reply: { body: run({ runId: "run_note", status: "awaiting_input", requiredAction: question }) },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_note/messages",
        reply: { status: 202, body: { messageId: "m_1", status: "accepted" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_note",
        reply: { body: run({ runId: "run_note", status: "running" }) },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", maxCost: { amount: "30.00", currency: "USD" } },
    });
    const res = await call(handlers, "POST", "/v1/checkouts/run_note/messages", {
      body: { requestId: "req_size", values: { size: "M" }, text: "Gift wrap it, please" },
    });
    expect(res.status).toBe(200);
    const sent = calls.filter((c) => c.method === "POST" && c.path.endsWith("/run_note/messages"));
    expect(sent.map((c) => (c.body as { parts: unknown[] }).parts)).toEqual([
      [{ type: "input_response", requestId: "req_size", action: "submit", response: { kind: "form", values: { size: "M" } } }],
      [{ type: "text", text: "Gift wrap it, please" }],
    ]);
  });

  it("refuses an agent card that is spent or locked to another store", async () => {
    const { handlers } = makeServer([
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
      {
        method: "GET",
        path: "/unstable/order-intents/oi_spent",
        reply: {
          body: activeOrderIntent({
            orderIntentId: "oi_spent",
            amount: { currency: "USD", total: "50.00", available: "0.00", reserved: "0.00", spent: "50.00" },
          }),
        },
      },
      {
        method: "GET",
        path: "/unstable/order-intents/oi_other",
        reply: {
          body: activeOrderIntent({
            orderIntentId: "oi_other",
            merchant: { name: "Other", url: "https://other.example", countryCode: "US" },
          }),
        },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", {
      body: { startUrl: "https://shop.example/p/1", maxCost: { amount: "30.00", currency: "USD" } },
    });

    const spent = await call(handlers, "POST", "/v1/checkouts/run_1/agent-card", {
      body: { agentCardId: "oi_spent" },
    });
    expect(spent.status).toBe(409);
    expect((await spent.json()).error.code).toBe("agent_card_unusable");

    const other = await call(handlers, "POST", "/v1/checkouts/run_1/agent-card", {
      body: { agentCardId: "oi_other" },
    });
    expect(other.status).toBe(409);
    expect((await other.json()).error.code).toBe("agent_card_wrong_merchant");
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

  it("answers a password request with the protected input id, and never with values", async () => {
    let answered = false;
    const passwordRequest = {
      type: "input_response",
      requestId: "req_pw",
      messageId: "msg_pw",
      request: {
        question: "Enter your password for shop.example to sign in.",
        expiresAt: "2026-09-18T00:00:00.000Z",
        interaction: { kind: "protected", purpose: "password", merchant: { domain: "shop.example" } },
      },
    };
    const { handlers, calls } = makeServer([
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_pw",
        reply: () => ({
          body: run({
            runId: "run_pw",
            status: answered ? "running" : "awaiting_input",
            requiredAction: answered ? null : passwordRequest,
          }),
        }),
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/run_pw/messages",
        reply: () => {
          answered = true;
          return { status: 202, body: { messageId: "m_pw", status: "accepted" } };
        },
      },
    ]);
    // The view names the secret and where it is for, and offers no form for it.
    const view = await (await call(handlers, "GET", "/v1/checkouts/run_pw")).json();
    expect(view.pendingUserAction).toMatchObject({
      id: "req_pw",
      protected: { purpose: "password", merchant: { domain: "shop.example" } },
    });
    expect(view.rendered).toBeUndefined();
    // Where the user types it, for a caller that cannot show the field itself.
    expect(view.passwordRequest).toEqual({
      requestId: "req_pw",
      question: "Enter your password for shop.example to sign in.",
      merchantDomain: "shop.example",
      expiresAt: "2026-09-18T00:00:00.000Z",
      url: "https://wallet.test/checkouts/run_pw",
    });

    // A password typed as a value is refused, and nothing reaches Crossmint.
    const typed = await call(handlers, "POST", "/v1/checkouts/run_pw/messages", {
      body: { requestId: "req_pw", values: { password: "hunter2" } },
    });
    expect(typed.status).toBe(409);
    expect((await typed.json()).error.code).toBe("protected_input_required");
    expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/run_pw/messages"))).toBe(false);

    const reply = await call(handlers, "POST", "/v1/checkouts/run_pw/messages", {
      body: { requestId: "req_pw", protectedInputId: "pi_1", messageId: "client-pw" },
    });
    expect((await reply.json()).status).toBe("running");
    const sent = calls.find((c) => c.method === "POST" && c.path.endsWith("/run_pw/messages"))!;
    expect(sent.body).toEqual({
      id: "client-pw",
      parts: [
        {
          type: "input_response",
          requestId: "req_pw",
          action: "submit",
          response: { kind: "protected", protectedInputId: "pi_1" },
        },
      ],
    });
  });

  it("refuses a password asked for in a plain form, and renders no form for it", async () => {
    const passwordForm = {
      type: "input_response",
      requestId: "req_pwf",
      request: {
        question: "Please enter the password for the selected Amazon account.",
        expiresAt: "2026-09-18T00:00:00.000Z",
        interaction: {
          kind: "form",
          responseSchema: {
            type: "object",
            properties: { amazon_password: { type: "string", title: "Amazon account password" } },
            required: ["amazon_password"],
          },
        },
      },
    };
    const { handlers, calls } = makeServer([
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_pwf",
        reply: { body: run({ runId: "run_pwf", status: "awaiting_input", requiredAction: passwordForm }) },
      },
    ]);
    const view = await (await call(handlers, "GET", "/v1/checkouts/run_pwf")).json();
    expect(view.pendingUserAction).toMatchObject({ id: "req_pwf" });
    expect(view.rendered).toBeUndefined();
    const res = await call(handlers, "POST", "/v1/checkouts/run_pwf/messages", {
      body: { requestId: "req_pwf", values: { amazon_password: "hunter2" } },
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("password_in_form");
    expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/run_pwf/messages"))).toBe(false);
  });

  it("refuses a protected input id for a request that asks for no secret", async () => {
    const sizeRequest = {
      type: "input_response",
      requestId: "req_size2",
      request: {
        question: "Which size?",
        expiresAt: "2026-09-18T00:00:00.000Z",
        interaction: { kind: "form", responseSchema: { type: "object", properties: { size: { type: "string" } } } },
      },
    };
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/agent-checkouts/run_sz",
        reply: { body: run({ runId: "run_sz", status: "awaiting_input", requiredAction: sizeRequest }) },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/checkouts/run_sz/messages", {
      body: { requestId: "req_size2", protectedInputId: "pi_2" },
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("not_a_protected_request");
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

describe("sticky browser sessions", () => {
  const created = { status: 202, body: { runId: "run_1", status: "queued" } };
  const createRoute = { method: "POST" as const, path: /\/unstable\/agent-checkouts$/, reply: created };
  const body = { startUrl: "https://shop.example/p/1", maxCost: { amount: "5.00", currency: "USD" } };

  it("makes the user's profile the first time and reuses it after", async () => {
    let profiles: Array<{ id: string; label: string }> = [];
    const { handlers, calls } = makeServer([
      createRoute,
      {
        method: "GET",
        path: "/unstable/agent-checkouts/browser-profiles",
        reply: () => ({ body: { data: profiles, nextCursor: null } }),
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/browser-profiles",
        reply: () => {
          profiles = [{ id: "bp_new", label: "Merchant logins" }];
          return { status: 201, body: profiles[0] };
        },
      },
    ]);

    await call(handlers, "POST", "/v1/checkouts", { body });
    const made = findCall(calls, "POST", "/browser-profiles")!;
    // Server key plus the user id: without the header every end user's logins
    // would pile into the project's own shared profile.
    expect(made.headers).toMatchObject({ "X-API-KEY": "sk_test", "x-crossmint-user-id": "user-test-1" });
    expect(made.body).toEqual({ label: "Merchant logins" });
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
      browserProfileId: "bp_new",
    });

    // The second run is already signed in and asks Crossmint nothing.
    calls.length = 0;
    await call(handlers, "POST", "/v1/checkouts", { body });
    expect(findCall(calls, "GET", "/browser-profiles")).toBeUndefined();
    expect(findCall(calls, "POST", "/browser-profiles")).toBeUndefined();
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
      browserProfileId: "bp_new",
    });
  });

  it("reads the profile back when a run in flight made it first", async () => {
    const { handlers, calls } = makeServer([
      createRoute,
      {
        method: "GET",
        path: "/unstable/agent-checkouts/browser-profiles",
        reply: { body: { data: [], nextCursor: null } },
        once: true,
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/browser-profiles",
        reply: { status: 409, body: { code: "already_exists", message: "The user already has a browser profile." } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/browser-profiles",
        reply: { body: { data: [{ id: "bp_raced", label: "Merchant logins" }], nextCursor: null } },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", { body });
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
      browserProfileId: "bp_raced",
    });
  });

  it("buys anyway when the profile cannot be resolved", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handlers, calls } = makeServer([
      createRoute,
      {
        method: "GET",
        path: "/unstable/agent-checkouts/browser-profiles",
        reply: { status: 503, body: { message: "Upstream service unavailable" } },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/checkouts", { body });
    // A convenience must not take a purchase down with it.
    expect(res.status).toBe(201);
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).not.toHaveProperty(
      "browserProfileId",
    );
    expect(warn).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("starts signed out for freshBrowser, and takes an explicit profile over the user's own", async () => {
    const { handlers, calls } = makeServer([createRoute]);
    await call(handlers, "POST", "/v1/checkouts", { body: { ...body, freshBrowser: true } });
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).not.toHaveProperty(
      "browserProfileId",
    );
    // Nothing was asked of Crossmint: a fresh browser needs no profile at all.
    expect(findCall(calls, "GET", "/browser-profiles")).toBeUndefined();

    calls.length = 0;
    await call(handlers, "POST", "/v1/checkouts", { body: { ...body, browserProfileId: "bp_theirs" } });
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
      browserProfileId: "bp_theirs",
    });
    expect(findCall(calls, "GET", "/browser-profiles")).toBeUndefined();
  });

  it("deletes the saved logins and makes a new profile next time", async () => {
    const { handlers, calls } = makeServer([
      createRoute,
      { method: "DELETE", path: "/unstable/agent-checkouts/browser-profiles/", reply: { status: 204 } },
    ]);
    const res = await call(handlers, "DELETE", "/v1/browser-profile");
    expect(res.status).toBe(204);
    expect(findCall(calls, "DELETE", `/browser-profiles/${BROWSER_PROFILE_ID}`)).toBeDefined();

    // The cached id went with it, so the next run resolves from Crossmint again.
    calls.length = 0;
    await call(handlers, "POST", "/v1/checkouts", { body });
    expect(findCall(calls, "GET", "/browser-profiles")).toBeDefined();
  });

  it("reports the profile without leaking anything about the logins", async () => {
    const { handlers } = makeServer();
    const res = await call(handlers, "GET", "/v1/browser-profile");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ browserProfile: { id: BROWSER_PROFILE_ID } });
  });
});

describe("saved buyer details", () => {
  const created = { status: 202, body: { runId: "run_1", status: "queued" } };
  const createRoute = { method: "POST" as const, path: /\/unstable\/agent-checkouts$/, reply: created };
  const body = { startUrl: "https://shop.example/p/1", maxCost: { amount: "5.00", currency: "USD" } };
  const details = {
    label: "Home",
    name: { first: "Ada", last: "Lovelace" },
    contact: { email: "ada@example.com" },
    shipping: {
      addressLines: ["1 Main St"],
      locality: "Springfield",
      administrativeAreaCode: "US-IL",
      postalCode: "62701",
      countryCode: "US",
    },
  };

  it("starts every checkout with the newest saved profile", async () => {
    const { handlers, calls } = makeServer([
      createRoute,
      {
        method: "GET",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: {
          body: {
            data: [
              { id: "byp_old", ...details, createdAt: "2026-01-01T00:00:00.000Z" },
              { id: "byp_new", ...details, label: "New flat", createdAt: "2026-06-01T00:00:00.000Z" },
            ],
            nextCursor: null,
          },
        },
      },
    ]);
    await call(handlers, "POST", "/v1/checkouts", { body });
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
      buyerProfileId: "byp_new",
    });

    // A caller that names its own profile keeps it.
    await call(handlers, "POST", "/v1/checkouts", { body: { ...body, buyerProfileId: "byp_mine" } });
    expect(calls.filter((c) => c.method === "POST" && /agent-checkouts$/.test(c.path)).at(-1)!.body).toMatchObject({
      buyerProfileId: "byp_mine",
    });
  });

  it("uses details saved mid-conversation on the next checkout, without asking Crossmint again", async () => {
    const { handlers, calls } = makeServer([
      createRoute,
      {
        method: "GET",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { body: { data: [], nextCursor: null } },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { status: 201, body: { id: "byp_saved" } },
      },
    ]);
    const none = await call(handlers, "GET", "/v1/buyer-profile");
    expect(await none.json()).toEqual({ buyerProfile: null });

    const saved = await call(handlers, "POST", "/v1/buyer-profiles", { body: details });
    expect(saved.status).toBe(201);

    calls.length = 0;
    await call(handlers, "POST", "/v1/checkouts", { body });
    expect(findCall(calls, "GET", "/buyer-profiles")).toBeUndefined();
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
      buyerProfileId: "byp_saved",
    });
    const read = await call(handlers, "GET", "/v1/buyer-profile");
    expect(await read.json()).toMatchObject({
      buyerProfile: { id: "byp_saved", name: { first: "Ada", last: "Lovelace" } },
    });
  });

  it("finds details saved on another instance, even when Crossmint lists none", async () => {
    const routes = [
      createRoute,
      {
        method: "GET",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { body: { data: [], nextCursor: null } },
      },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { status: 201, body: { id: "byp_saved" } },
      },
    ];
    const first = makeServer(routes);
    await call(first.handlers, "POST", "/v1/buyer-profiles", { body: details });

    // A second instance: its own memory, the same store.
    const second = makeServer(routes, { store: first.store });
    const read = await call(second.handlers, "GET", "/v1/buyer-profile");
    expect(await read.json()).toMatchObject({
      buyerProfile: { id: "byp_saved", name: { first: "Ada", last: "Lovelace" } },
    });
    await call(second.handlers, "POST", "/v1/checkouts", { body });
    expect(findCall(second.calls, "POST", /\/unstable\/agent-checkouts$/)!.body).toMatchObject({
      buyerProfileId: "byp_saved",
    });
    expect(findCall(second.calls, "GET", "/buyer-profiles")).toBeUndefined();
  });

  it("refuses details a store cannot ship to, field by field, without calling Crossmint", async () => {
    const { handlers, calls } = makeServer([]);
    const res = await call(handlers, "POST", "/v1/buyer-profiles", {
      body: {
        ...details,
        name: { first: " ", last: "Lovelace" },
        shipping: { ...details.shipping, postalCode: "627" },
      },
    });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("invalid_request");
    expect(error.message).toBe("Enter a first name. Enter a 5-digit ZIP code, such as 94103.");
    expect(error.details.problems.map((p: { field: string }) => p.field)).toEqual([
      "firstName",
      "postalCode",
    ]);
    expect(findCall(calls, "POST", "/buyer-profiles")).toBeUndefined();
  });

  it("deletes every saved profile, so the next checkout starts with none", async () => {
    const { handlers, calls } = makeServer([
      createRoute,
      // Two pages to delete, then nothing left.
      {
        method: "GET",
        path: "/unstable/agent-checkouts/buyer-profiles",
        once: true,
        reply: { body: { data: [{ id: "byp_old", ...details }], nextCursor: "next" } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/buyer-profiles",
        once: true,
        reply: { body: { data: [{ id: "byp_new", ...details }], nextCursor: null } },
      },
      {
        method: "GET",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { body: { data: [], nextCursor: null } },
      },
      // One is gone already: that is no reason to fail.
      { method: "DELETE", path: "/buyer-profiles/byp_old", reply: { status: 404, body: { message: "Not found" } } },
      { method: "DELETE", path: "/buyer-profiles/byp_new", reply: { status: 204 } },
      {
        method: "POST",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { status: 201, body: { id: "byp_saved" } },
      },
    ]);
    // A profile saved earlier is cached, and must not outlive the delete.
    await call(handlers, "POST", "/v1/buyer-profiles", { body: details });

    const res = await call(handlers, "DELETE", "/v1/buyer-profile");
    expect(res.status).toBe(204);
    expect(findCall(calls, "DELETE", "/buyer-profiles/byp_old")).toBeDefined();
    expect(findCall(calls, "DELETE", "/buyer-profiles/byp_new")).toBeDefined();

    const read = await call(handlers, "GET", "/v1/buyer-profile");
    expect(await read.json()).toEqual({ buyerProfile: null });
    calls.length = 0;
    await call(handlers, "POST", "/v1/checkouts", { body });
    expect(findCall(calls, "POST", /\/unstable\/agent-checkouts$/)!.body).not.toHaveProperty(
      "buyerProfileId",
    );
  });

  it("reports a delete Crossmint refuses", async () => {
    const { handlers } = makeServer([
      {
        method: "GET",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { body: { data: [{ id: "byp_1", ...details }], nextCursor: null } },
      },
      { method: "DELETE", path: "/buyer-profiles/byp_1", reply: { status: 403, body: { message: "Missing scope" } } },
    ]);
    const res = await call(handlers, "DELETE", "/v1/buyer-profile");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("saves the state as ISO 3166-2", async () => {
    const { handlers, calls } = makeServer([
      {
        method: "POST",
        path: "/unstable/agent-checkouts/buyer-profiles",
        reply: { status: 201, body: { id: "byp_saved" } },
      },
    ]);
    const res = await call(handlers, "POST", "/v1/buyer-profiles", {
      body: { ...details, shipping: { ...details.shipping, administrativeAreaCode: "il", countryCode: "us" } },
    });
    expect(res.status).toBe(201);
    expect(findCall(calls, "POST", "/buyer-profiles")!.body).toMatchObject({
      shipping: { administrativeAreaCode: "US-IL", countryCode: "US" },
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
