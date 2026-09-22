import { describe, expect, it } from "vitest";
import { runCli } from "../src/program.js";
import { EXIT } from "../src/output.js";
import type { AgentCardRequest } from "../src/types.js";
import { fakeFetch, json, testContext } from "./helpers.js";

function request(overrides: Partial<AgentCardRequest> = {}): AgentCardRequest {
  const now = new Date();
  return {
    id: "acr_123",
    userId: "u1",
    requester: "Claude Code",
    amount: { value: "50.00", currency: "USD" },
    description: "Flight to SF",
    expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
    requestExpiresAt: new Date(now.getTime() + 900_000).toISOString(),
    status: "pending",
    approvalUrl: "https://wallet.test/approve/acr_123",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe("agent-commerce agent-card request", () => {
  it("parses options into the POST body and prints the approval URL", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/agent-card-requests": (call) => json(request({ ...(call.body as object) }), 201),
    });
    const t = testContext({ fetch, env: { CLAUDECODE: "1" } });
    const code = await runCli(
      [
        "agent-card",
        "request",
        "--amount",
        "$49.9",
        "--description",
        "Flight to SF",
        "--merchant-name",
        "United",
        "--merchant-url",
        "https://united.com",
        "--merchant-country",
        "us",
        "--expires-in-hours",
        "48",
      ],
      t.overrides,
    );
    expect(t.stderr).toEqual([]);
    expect(code).toBe(EXIT.OK);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe("https://wallet.test/api/agent-commerce/v1/agent-card-requests");
    expect(calls[0]?.headers.authorization).toBe("Bearer access-1");
    expect(calls[0]?.body).toEqual({
      amount: { value: "49.90", currency: "USD" },
      description: "Flight to SF",
      merchant: { name: "United", url: "https://united.com", countryCode: "US" },
      expiresInHours: 48,
      requester: "Claude Code",
    });
    const out = t.stdout.join("\n");
    expect(out).toContain("Open this link to approve:");
    expect(out).toContain("https://wallet.test/approve/acr_123");
  });

  it("uses defaults and --requester, and prints raw JSON with --json", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/agent-card-requests": (call) => json(request({ ...(call.body as object) }), 201),
    });
    const t = testContext({ fetch });
    const code = await runCli(
      [
        "agent-card",
        "request",
        "--amount",
        "50",
        "--description",
        "Books",
        "--requester",
        "My Bot",
        "--json",
      ],
      t.overrides,
    );
    expect(code).toBe(EXIT.OK);
    expect(calls[0]?.body).toEqual({
      amount: { value: "50.00", currency: "USD" },
      description: "Books",
      expiresInHours: 24,
      requester: "My Bot",
    });
    const parsed = JSON.parse(t.stdout.join("\n")) as AgentCardRequest;
    expect(parsed.id).toBe("acr_123");
    expect(parsed.approvalUrl).toBe("https://wallet.test/approve/acr_123");
  });

  it("detects the requester from the hostname when no agent env is set", async () => {
    const { fetch, calls } = fakeFetch({
      "POST /v1/agent-card-requests": (call) => json(request({ ...(call.body as object) }), 201),
    });
    const t = testContext({ fetch });
    await runCli(["agent-card", "request", "--amount", "5", "--description", "x"], t.overrides);
    expect((calls[0]?.body as { requester: string }).requester).toBe("agent-commerce CLI on testbox");
  });

  it("rejects a partial merchant and a bad amount without calling the API", async () => {
    const { fetch, calls } = fakeFetch({});
    const t = testContext({ fetch });
    const partial = await runCli(
      ["agent-card", "request", "--amount", "5", "--description", "x", "--merchant-name", "United"],
      t.overrides,
    );
    expect(partial).toBe(EXIT.ERROR);
    expect(t.stderr.join("\n")).toContain("--merchant-country");
    const bad = await runCli(
      ["agent-card", "request", "--amount", "-1", "--description", "x"],
      t.overrides,
    );
    expect(bad).toBe(EXIT.ERROR);
    expect(calls).toHaveLength(0);
  });

  it("--wait polls until active and prints the agent card", async () => {
    let polls = 0;
    const card = {
      orderIntentId: "oi_1",
      paymentMethodId: "pm_1",
      description: "Flight to SF",
      status: "active",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      amount: {
        currency: "USD",
        total: "50.00",
        available: "50.00",
        reserved: "0.00",
        spent: "0.00",
      },
      rails: [{ rail: "agentic-token", provider: "vic", status: "active" }],
    };
    const { fetch } = fakeFetch({
      "POST /v1/agent-card-requests": () => json(request(), 201),
      "GET /v1/agent-card-requests/acr_123": () => {
        polls += 1;
        return json(
          polls < 3
            ? request({ status: polls === 1 ? "pending" : "approved" })
            : request({ status: "active", agentCardId: "oi_1" }),
        );
      },
      "GET /v1/agent-cards/oi_1": () => json(card),
    });
    const t = testContext({ fetch });
    const code = await runCli(
      [
        "agent-card",
        "request",
        "--amount",
        "50",
        "--description",
        "Flight to SF",
        "--wait",
        "--json",
      ],
      t.overrides,
    );
    expect(code).toBe(EXIT.OK);
    expect(polls).toBe(3);
    const parsed = JSON.parse(t.stdout.join("\n")) as {
      request: AgentCardRequest;
      agentCard: { orderIntentId: string };
    };
    expect(parsed.request.status).toBe("active");
    expect(parsed.agentCard.orderIntentId).toBe("oi_1");
    expect(t.stderr.join("\n")).toContain("Approval URL: https://wallet.test/approve/acr_123");
  });

  it("--wait exits 1 when the user denies", async () => {
    const { fetch } = fakeFetch({
      "POST /v1/agent-card-requests": () => json(request(), 201),
      "GET /v1/agent-card-requests/acr_123": () => json(request({ status: "denied" })),
    });
    const t = testContext({ fetch });
    const code = await runCli(
      ["agent-card", "request", "--amount", "50", "--description", "x", "--wait"],
      t.overrides,
    );
    expect(code).toBe(EXIT.ERROR);
    expect(t.stderr.join("\n")).toContain("denied");
  });

  it("exits 3 when there is no session", async () => {
    const { fetch, calls } = fakeFetch({});
    const t = testContext({ fetch, config: null });
    const code = await runCli(
      ["agent-card", "request", "--amount", "50", "--description", "x"],
      t.overrides,
    );
    expect(code).toBe(EXIT.NOT_LOGGED_IN);
    expect(calls).toHaveLength(0);
    expect(t.stderr.join("\n")).toContain("agent-commerce login");
  });
});
