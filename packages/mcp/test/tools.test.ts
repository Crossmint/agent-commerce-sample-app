import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TOOL_DOCS } from "@agent-commerce/core";
import { createAgentCommerceMcpServer, AGENT_COMMERCE_TOOL_NAMES } from "../src/index.js";
import { mockAgentCommerceFetch } from "./helpers.js";

const API = "https://wallet.example.com/api/agent-commerce";

async function connect(fetchImpl: typeof fetch) {
  const server = createAgentCommerceMcpServer({ apiBaseUrl: API, bearerToken: "tok_1", requester: "Test agent", fetch: fetchImpl });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe("Agent Commerce tools", () => {
  it("registers every tool by name", async () => {
    const { client } = await connect(mockAgentCommerceFetch({}));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...AGENT_COMMERCE_TOOL_NAMES].sort());
    // Every description opens with the summary shared with the chat agent (core TOOL_DOCS).
    for (const tool of tools) {
      const doc = TOOL_DOCS[tool.name as keyof typeof TOOL_DOCS];
      expect(tool.description, tool.name).toMatch(new RegExp(`^${doc.summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      expect(tool.title).toBe(doc.title);
    }
  });

  it("request_agent_card posts the request and returns the approval URL", async () => {
    const fetchMock = mockAgentCommerceFetch({
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
      mockAgentCommerceFetch({
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
    const result = await client.callTool({ name: "reveal_agent_card", arguments: { agentCardId: "oi_1" } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("WARNING");
    expect(result.structuredContent).toMatchObject({ enforced: false, card: { number: "4111111111111111" } });
  });

  it("get_checkout hands a protected request over as a link, never as a form", async () => {
    const passwordField = {
      key: "password",
      label: "Password",
      required: true,
      handling: "protected",
      input: { kind: "text", display: "masked", autoComplete: "current-password" },
    };
    const { client } = await connect(
      mockAgentCommerceFetch({
        "GET /v1/checkouts/run_pw": {
          status: 200,
          body: {
            id: "run_pw",
            status: "awaiting_input",
            pendingUserAction: {
              id: "req_pw",
              question: "Sign in to shop.example to continue.",
              fields: [
                {
                  key: "email",
                  label: "Email",
                  required: true,
                  handling: "standard",
                  input: { kind: "text", autoComplete: "email" },
                },
                passwordField,
              ],
            },
            // The server renders the form for the app's own page, protected field included.
            rendered: {
              id: "req_pw",
              type: "input_response",
              title: "Sign in to shop.example to continue.",
              fields: [
                { name: "email", label: "Email", kind: "text", required: true },
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
              url: "https://wallet.example.com/checkouts/run_pw",
            },
          },
        },
      }),
    );
    const result = await client.callTool({ name: "get_checkout", arguments: { checkoutId: "run_pw" } });
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("https://wallet.example.com/checkouts/run_pw");
    expect(text).toContain("shop.example asks for secrets: Password.");
    expect(text).toContain("Never ask the user for them");
    expect(text).not.toContain("Question (requestId");
    expect(text).not.toContain("Fields:");
    expect(text).not.toContain("Still running");
    expect((result.structuredContent as { checkout: Record<string, unknown> }).checkout.rendered).toBeUndefined();
  });

  it("get_checkout lists each field with the answers it accepts", async () => {
    const { client } = await connect(
      mockAgentCommerceFetch({
        "GET /v1/checkouts/run_1": {
          status: 200,
          body: {
            id: "run_1",
            status: "awaiting_input",
            pendingUserAction: {
              id: "req_1",
              question: "Pick your options.",
              fields: [
                {
                  key: "size",
                  label: "Size",
                  required: true,
                  handling: "standard",
                  input: {
                    kind: "choice",
                    selection: { kind: "one" },
                    options: [
                      { value: "", label: "Select a size", disabled: false, selected: false, placeholder: true },
                      { value: "m", label: "Medium", disabled: false, selected: true, placeholder: false },
                      { value: "l", label: "Large", disabled: true, selected: false, placeholder: false },
                    ],
                  },
                },
                {
                  key: "extras",
                  label: "Extras",
                  required: false,
                  handling: "standard",
                  input: {
                    kind: "choice",
                    selection: { kind: "many", min: 0, max: 2 },
                    options: [
                      { value: "wrap", label: "Gift wrap", disabled: false, selected: false, placeholder: false },
                      { value: "note", label: "Card", disabled: false, selected: false, placeholder: false },
                    ],
                  },
                },
                { key: "quantity", label: "Quantity", required: true, handling: "standard", input: { kind: "integer" } },
                { key: "notes", label: "Notes", required: false, handling: "standard", input: { kind: "text", multiline: true } },
              ],
            },
          },
        },
      }),
    );
    const result = await client.callTool({ name: "get_checkout", arguments: { checkoutId: "run_1" } });
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain('Question (requestId "req_1"): Pick your options.');
    expect(text).toContain('- size "Size" (select, required) one of: "m" (Medium); preselected "m"');
    expect(text).toContain('- extras "Extras" (multiselect) a list of 0 to 2 of: "wrap" (Gift wrap), "note" (Card)');
    expect(text).toContain('- quantity "Quantity" (whole number, required)');
    expect(text).toContain('- notes "Notes" (text, several lines)');
    const checkout = (result.structuredContent as { checkout: { rendered?: { fields: unknown[] } } }).checkout;
    expect(checkout.rendered?.fields).toHaveLength(4);
  });

  it("answer_checkout sends plain answers and refuses a protectedInputId from the agent", async () => {
    const fetchMock = mockAgentCommerceFetch({
      "POST /v1/checkouts/run_1/messages": { body: { id: "run_1", status: "running" } },
    });
    const { client } = await connect(fetchMock);
    const values = { size: "m", extras: ["wrap"], quantity: 2, gift: true };
    const sent = await client.callTool({
      name: "answer_checkout",
      arguments: { checkoutId: "run_1", requestId: "req_1", values },
    });
    expect(sent.isError).toBeFalsy();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ requestId: "req_1", values });

    const refused = await client.callTool({
      name: "answer_checkout",
      arguments: { checkoutId: "run_1", requestId: "req_1", values: { password: { protectedInputId: "pi_1" } } },
    });
    expect(refused.isError).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns Agent Commerce API errors into isError results", async () => {
    const { client } = await connect(
      mockAgentCommerceFetch({
        "GET /v1/agent-cards/nope": { status: 404, body: { error: { code: "not_found", message: "No such agent card" } } },
      }),
    );
    const result = await client.callTool({ name: "get_agent_card", arguments: { agentCardId: "nope" } });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ type: string; text: string }>)[0]!.text).toContain("not_found");
  });
});
