import { describe, expect, it } from "vitest";
import { runCli } from "../src/program.js";
import { EXIT } from "../src/output.js";
import { fakeFetch, json, testContext } from "./helpers.js";

describe("goat checkout", () => {
  it("create --wait stops with exit 2 and instructions when a question appears", async () => {
    let polls = 0;
    const { fetch, calls } = fakeFetch({
      "POST /v1/checkouts": () => json({ id: "co_1", status: "pending", agentCardId: "oi_1" }, 201),
      "GET /v1/checkouts/co_1": () => {
        polls += 1;
        if (polls === 1) return json({ id: "co_1", status: "running", agentCardId: "oi_1" });
        return json({
          id: "co_1",
          status: "awaiting_user_action",
          agentCardId: "oi_1",
          pendingUserAction: {
            id: "act_1",
            type: "shipping",
            responseSchema: {
              type: "object",
              required: ["fullName"],
              properties: {
                fullName: { type: "string" },
                country: { type: "string", enum: ["US", "GB"] },
              },
            },
          },
        });
      },
    });
    const t = testContext({ fetch });
    const code = await runCli(
      [
        "checkout",
        "create",
        "--url",
        "https://shop.test/p/1",
        "--agent-card",
        "oi_1",
        "--max-cost",
        "100",
        "--request",
        "medium, black",
        "--wait",
      ],
      t.overrides,
    );
    expect(code).toBe(EXIT.NEEDS_USER_ACTION);
    expect(calls[0]?.body).toEqual({
      url: "https://shop.test/p/1",
      agentCardId: "oi_1",
      maxCost: { amount: "100.00", currency: "USD" },
      request: "medium, black",
    });
    const out = t.stdout.join("\n");
    expect(out).toContain("Action needed: Shipping");
    expect(out).toContain("fullName*");
    expect(out).toContain(
      `goat checkout answer co_1 act_1 --values '{"fullName":"","country":"US"}'`,
    );
  });

  it("answer posts values and reports success", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/checkouts/co_1/actions/act_1": () =>
        json({
          id: "co_1",
          status: "succeeded",
          receipt: { total: "42.00", merchantOrderId: "ORD-9" },
        }),
    });
    const t = testContext({ fetch });
    const code = await runCli(
      ["checkout", "answer", "co_1", "act_1", "--values", '{"fullName":"Ada"}'],
      t.overrides,
    );
    expect(code).toBe(EXIT.OK);
    expect(calls[0]?.body).toEqual({ values: { fullName: "Ada" } });
    expect(t.stdout.join("\n")).toContain("succeeded");
    expect(t.stdout.join("\n")).toContain("ORD-9");
  });

  it("get exits 1 on a failed checkout", async () => {
    const { fetch } = fakeFetch({
      "GET /v1/checkouts/co_2": () =>
        json({ id: "co_2", status: "failed", failure: { reason: "max_cost_exceeded" } }),
    });
    const t = testContext({ fetch });
    const code = await runCli(["checkout", "get", "co_2", "--json"], t.overrides);
    expect(code).toBe(EXIT.ERROR);
    expect(JSON.parse(t.stderr.join("\n"))).toMatchObject({ error: { code: "failed" } });
  });
});
