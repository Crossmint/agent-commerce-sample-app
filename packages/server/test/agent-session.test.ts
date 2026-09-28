import { describe, expect, it, vi } from "vitest";
import type { UserAuth } from "@agent-commerce/auth";
import { call, makeServer } from "./helpers.js";

/** An auth adapter that sees "acc_*" as agent access tokens and "sess_*" as session JWTs. */
function exchangingAuth() {
  const exchange = vi.fn(async (accessToken: string) => ({
    sessionToken: `st_${accessToken}`,
    jwt: `sess_${accessToken}_1`,
    expiresAt: new Date(Date.now() + 5 * 60_000),
    userId: "user-test-1",
  }));
  const refresh = vi.fn(async (sessionToken: string) => ({
    jwt: `sess_refreshed_${sessionToken}`,
    expiresAt: new Date(Date.now() + 5 * 60_000),
  }));
  const auth: UserAuth = {
    async verify(jwt) {
      if (jwt.startsWith("acc_")) return { userId: "user-test-1", jwt, kind: "access" };
      if (jwt.startsWith("sess_")) return { userId: "user-test-1", jwt, kind: "session" };
      return null;
    },
    refresh,
    exchangeAccessToken: exchange,
  };
  return { auth, exchange, refresh };
}

describe("agent access tokens", () => {
  it("exchanges once, then reuses the stored session JWT for Crossmint calls", async () => {
    const { auth, exchange } = exchangingAuth();
    const { handlers, calls } = makeServer(
      [{ method: "GET", path: "/order-intents", reply: { body: [] } }],
      { userAuth: auth },
    );
    const first = await call(handlers, "GET", "/v1/agent-cards", { auth: "acc_abc" });
    expect(first.status).toBe(200);
    const second = await call(handlers, "GET", "/v1/agent-cards", { auth: "acc_abc" });
    expect(second.status).toBe(200);
    expect(exchange).toHaveBeenCalledTimes(1);
    // Crossmint got the session JWT, not the access token.
    for (const c of calls) expect(c.headers.Authorization).toBe("Bearer sess_acc_abc_1");
  });

  it("refreshes through the stored session token when the JWT is about to expire", async () => {
    const { auth, exchange, refresh } = exchangingAuth();
    exchange.mockResolvedValueOnce({
      sessionToken: "st_x",
      jwt: "sess_old",
      expiresAt: new Date(Date.now() + 1_000), // inside the refresh margin
      userId: "user-test-1",
    });
    const { handlers, calls } = makeServer(
      [{ method: "GET", path: "/order-intents", reply: { body: [] } }],
      { userAuth: auth },
    );
    await call(handlers, "GET", "/v1/agent-cards", { auth: "acc_x" });
    await call(handlers, "GET", "/v1/agent-cards", { auth: "acc_x" });
    expect(refresh).toHaveBeenCalledWith("st_x");
    expect(calls.at(-1)?.headers.Authorization).toBe("Bearer sess_refreshed_st_x");
  });

  it("returns 401 with guidance when the exchange fails", async () => {
    const { auth, exchange } = exchangingAuth();
    exchange.mockRejectedValueOnce(new Error("token too old"));
    const { handlers } = makeServer([], { userAuth: auth });
    const res = await call(handlers, "GET", "/v1/me", { auth: "acc_old" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toMatch(/first-party|Log in again/);
  });
});
