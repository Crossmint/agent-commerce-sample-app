import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createGoatMcpServer, GOAT_TOOL_NAMES } from "../src/index.js";
import { mockGoatFetch } from "./helpers.js";

const API = "https://wallet.example.com/api/goat";

async function connect(fetchImpl: typeof fetch) {
  const server = createGoatMcpServer({ apiBaseUrl: API, bearerToken: "tok_1", requester: "Test agent", fetch: fetchImpl });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe("GOAT tools", () => {
  it("registers every tool by name", async () => {
    const { client } = await connect(mockGoatFetch({}));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...GOAT_TOOL_NAMES].sort());
    for (const tool of tools) expect(tool.description).toBeTruthy();
  });

  it("request_agent_card posts the request and returns the approval URL", async () => {
    const fetchMock = mockGoatFetch({
      "POST /v1/agent-card-requests": (init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return {
          id: "acr_123",
          userId: "user-1",
          requester: body.requester,
          amount: body.amount,
          description: body.description,
          expiresAt: "2030-01-02T00:00:00.000Z",
          requestExpiresAt: "2030-01-01T00:15:00.000Z",
          status: "pending",
          approvalUrl: "https://wallet.example.com/approve/acr_123",
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: "2030-01-01T00:00:00.000Z",
        };
      },
    });
    const { client } = await connect(fetchMock);
    const result = await client.callTool({
      name: "request_agent_card",
      arguments: { amount: 50, description: "Flight to SF" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/v1/agent-card-requests`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok_1");
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: { value: "50.00", currency: "USD" },
      description: "Flight to SF",
      requester: "Test agent",
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      requestId: "acr_123",
      approvalUrl: "https://wallet.example.com/approve/acr_123",
      status: "pending",
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("https://wallet.example.com/approve/acr_123");
    expect(text).toContain("get_agent_card_request");
  });

  it("reveal_agent_card warns when the limit is not enforced", async () => {
    const { client } = await connect(
      mockGoatFetch({
        "POST /v1/agent-cards/oi_1/credentials": {
          body: {
            agentCardId: "oi_1",
            rail: "encrypted-card",
            enforced: false,
            card: { number: "4111111111111111", expirationMonth: "12", expirationYear: "2030", cvc: "123" },
          },
        },
      }),
    );
    const result = await client.callTool({ name: "reveal_agent_card", arguments: { id: "oi_1" } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("WARNING");
    expect(result.structuredContent).toMatchObject({ enforced: false, card: { number: "4111111111111111" } });
  });

  it("turns GOAT API errors into isError results", async () => {
    const { client } = await connect(
      mockGoatFetch({
        "GET /v1/agent-cards/nope": { status: 404, body: { error: { code: "not_found", message: "No such agent card" } } },
      }),
    );
    const result = await client.callTool({ name: "get_agent_card", arguments: { id: "nope" } });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ type: string; text: string }>)[0]!.text).toContain("not_found");
  });
});
