import { describe, expect, it } from "vitest";
import { runCli } from "../src/program.js";
import { EXIT } from "../src/output.js";
import { fakeFetch, json, testContext } from "./helpers.js";

describe("goat checkout", () => {
  it("create --wait stops with exit 2 and instructions when a question appears", async () => {
    let polls = 0;
    const { fetch, calls } = fakeFetch({
      "POST /v1/checkouts": () => json({ id: "run_1", status: "queued", agentCardId: "oi_1" }, 201),
      "GET /v1/checkouts/run_1": () => {
        polls += 1;
        if (polls === 1) return json({ id: "run_1", status: "running", agentCardId: "oi_1" });
        return json({
          id: "run_1",
          status: "awaiting_input",
          agentCardId: "oi_1",
          pendingUserAction: {
            id: "req_1",
            question: "Where should we ship this?",
            expiresAt: "2026-09-18T00:00:00.000Z",
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
        "--task",
        "medium, black",
        "--buyer-profile",
        "bp_1",
        "--wait",
      ],
      t.overrides,
    );
    expect(code).toBe(EXIT.NEEDS_USER_ACTION);
    expect(calls[0]?.body).toEqual({
      startUrl: "https://shop.test/p/1",
      agentCardId: "oi_1",
      maxCost: { amount: "100.00", currency: "USD" },
      task: "medium, black",
      buyerProfileId: "bp_1",
    });
    const out = t.stdout.join("\n");
    expect(out).toContain("Action needed: Where should we ship this?");
    expect(out).toContain("fullName*");
    expect(out).toContain(
      `goat checkout answer run_1 req_1 --values '{"fullName":"","country":"US"}'`,
    );
  });

  it("still maps --request to the task", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/checkouts": () => json({ id: "run_1", status: "queued" }, 201),
    });
    const t = testContext({ fetch });
    const code = await runCli(
      ["checkout", "create", "--url", "https://shop.test/p/1", "--agent-card", "oi_1", "--max-cost", "5", "--request", "blue"],
      t.overrides,
    );
    expect(code).toBe(EXIT.OK);
    expect(calls[0]?.body).toMatchObject({ task: "blue" });
  });

  it("answer posts one message with the values and reports the receipt", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/checkouts/run_1/messages": () =>
        json({
          id: "run_1",
          status: "succeeded",
          result: { outcome: "succeeded", summary: "Bought the tee.", purchase: { kind: "receipt_captured", receipt: { total: { amount: "42.00", currency: "USD" }, merchantOrderId: "ORD-9" } } },
          receipt: { total: { amount: "42.00", currency: "USD" }, merchantOrderId: "ORD-9" },
        }),
    });
    const t = testContext({ fetch });
    const code = await runCli(
      ["checkout", "answer", "run_1", "req_1", "--values", '{"fullName":"Ada"}'],
      t.overrides,
    );
    expect(code).toBe(EXIT.OK);
    expect(calls[0]?.body).toEqual({ requestId: "req_1", action: "submit", values: { fullName: "Ada" } });
    const out = t.stdout.join("\n");
    expect(out).toContain("succeeded");
    expect(out).toContain("42.00 USD");
    expect(out).toContain("ORD-9");
  });

  it("answer --decline and --alternative send the matching actions", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/checkouts/run_1/messages": () => json({ id: "run_1", status: "running" }),
    });
    const t = testContext({ fetch });
    expect(await runCli(["checkout", "answer", "run_1", "req_1", "--decline"], t.overrides)).toBe(EXIT.OK);
    expect(await runCli(["checkout", "answer", "run_1", "req_1", "--alternative", "cheapest shipping"], t.overrides)).toBe(EXIT.OK);
    expect(calls[0]?.body).toEqual({ requestId: "req_1", action: "decline" });
    expect(calls[1]?.body).toEqual({ requestId: "req_1", action: "alternative", text: "cheapest shipping" });
    expect(await runCli(["checkout", "answer", "run_1", "req_1", "--decline", "--values", "{}"], t.overrides)).toBe(EXIT.ERROR);
  });

  it("get exits 1 on a blocked or failed checkout", async () => {
    const { fetch } = fakeFetch({
      "GET /v1/checkouts/run_2": () =>
        json({ id: "run_2", status: "blocked", result: { outcome: "blocked", code: "policy.max_cost_exceeded", summary: "Over the cap." }, failure: { reason: "policy.max_cost_exceeded", message: "Over the cap." } }),
      "GET /v1/checkouts/run_3": () => json({ id: "run_3", status: "failed", failure: { reason: "input_expired" } }),
    });
    const t = testContext({ fetch });
    expect(await runCli(["checkout", "get", "run_2", "--json"], t.overrides)).toBe(EXIT.ERROR);
    expect(JSON.parse(t.stderr.join("\n"))).toMatchObject({ error: { code: "blocked" } });
    const t2 = testContext({ fetch });
    expect(await runCli(["checkout", "get", "run_3"], t2.overrides)).toBe(EXIT.ERROR);
    expect(t2.stderr.join("\n")).toContain("input_expired");
  });

  it("cancel posts to the cancel route", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/checkouts/run_1/cancel": () => json({ id: "run_1", status: "running" }),
    });
    const t = testContext({ fetch });
    expect(await runCli(["checkout", "cancel", "run_1"], t.overrides)).toBe(EXIT.OK);
    expect(calls[0]?.url).toContain("/v1/checkouts/run_1/cancel");
  });
});
