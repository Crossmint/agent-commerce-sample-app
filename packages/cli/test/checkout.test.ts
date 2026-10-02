import { describe, expect, it } from "vitest";
import { runCli } from "../src/program.js";
import { EXIT } from "../src/output.js";
import { fakeFetch, json, testContext } from "./helpers.js";

describe("agent-commerce checkout", () => {
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
            fields: [
              {
                key: "fullName",
                label: "Full name",
                required: true,
                handling: "standard",
                input: { kind: "text", autoComplete: "name" },
              },
              {
                key: "country",
                label: "Country",
                required: false,
                handling: "standard",
                input: {
                  kind: "choice",
                  selection: { kind: "one" },
                  options: [
                    { value: "US", label: "United States", disabled: false, selected: false, placeholder: false },
                    { value: "GB", label: "United Kingdom", disabled: false, selected: false, placeholder: false },
                  ],
                },
              },
              {
                key: "addOns",
                label: "Add-ons",
                required: false,
                handling: "standard",
                input: {
                  kind: "choice",
                  selection: { kind: "many", min: 0 },
                  options: [
                    { value: "wrap", label: "Gift wrap", disabled: false, selected: false, placeholder: false },
                  ],
                },
              },
              { key: "quantity", label: "Quantity", required: true, handling: "standard", input: { kind: "integer" } },
              { key: "gift", label: "Gift", required: false, handling: "standard", input: { kind: "boolean" } },
            ],
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
    expect(out).toContain('(one of: "US", "GB") Country');
    expect(out).toContain('(list of any of: "wrap") Add-ons');
    expect(out).toContain("(whole number) Quantity");
    expect(out).toContain(
      `agent-commerce checkout answer run_1 req_1 --values '{"fullName":"","country":"US","addOns":[],"quantity":0,"gift":false}'`,
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

  it("get stops at a protected request with the page to open, never a form to answer", async () => {
    const passwordField = {
      key: "password",
      label: "Password",
      required: true,
      handling: "protected",
      input: { kind: "text", display: "masked", autoComplete: "current-password" },
    };
    const { fetch } = fakeFetch({
      "GET /v1/checkouts/run_pw": () =>
        json({
          id: "run_pw",
          status: "awaiting_input",
          pendingUserAction: {
            id: "req_pw",
            question: "Sign in to shop.example to continue.",
            fields: [passwordField],
          },
          // The server renders the form for the app's own page, protected field included.
          rendered: {
            id: "req_pw",
            type: "input_response",
            title: "Sign in to shop.example to continue.",
            fields: [
              {
                name: "password",
                label: "Password",
                kind: "protected",
                required: true,
                protectedField: passwordField,
              },
            ],
          },
          protectedRequest: {
            requestId: "req_pw",
            question: "Sign in to shop.example to continue.",
            fields: [{ key: "password", label: "Password" }],
            merchantDomain: "shop.example",
            url: "https://wallet.test/checkouts/run_pw",
          },
        }),
    });
    const t = testContext({ fetch });
    expect(await runCli(["checkout", "get", "run_pw", "--wait"], t.overrides)).toBe(
      EXIT.NEEDS_USER_ACTION,
    );
    const out = t.stdout.join("\n");
    expect(out).toContain("Secure input needed.");
    expect(out).toContain("shop.example asks for Password.");
    expect(out).toContain("https://wallet.test/checkouts/run_pw");
    expect(out).not.toContain("Action needed");
    expect(out).not.toContain("--values");
    const t2 = testContext({ fetch });
    expect(await runCli(["checkout", "get", "run_pw", "--json"], t2.overrides)).toBe(
      EXIT.NEEDS_USER_ACTION,
    );
    const error = JSON.parse(t2.stderr.join("\n")) as { error: { code: string; message: string } };
    expect(error.error.code).toBe("protected_input_needed");
    expect(error.error.message).toContain("https://wallet.test/checkouts/run_pw");
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
