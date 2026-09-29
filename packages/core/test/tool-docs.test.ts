import { describe, expect, it } from "vitest";
import { describeTool, AGENT_COMMERCE_TOOL_NAMES, paramDoc, TOOL_DOCS, toolNamesFor } from "../src/tool-docs.js";

describe("tool docs", () => {
  it("every tool has a title, a summary, and at least one surface", () => {
    for (const name of AGENT_COMMERCE_TOOL_NAMES) {
      const doc = TOOL_DOCS[name];
      expect(doc.title.length, name).toBeGreaterThan(3);
      expect(doc.summary.length, name).toBeGreaterThan(20);
      expect(doc.surfaces.length, name).toBeGreaterThan(0);
    }
  });
  it("splits tools by surface", () => {
    expect(toolNamesFor("mcp")).toContain("get_agent_card_request");
    expect(toolNamesFor("mcp")).not.toContain("await_agent_card_approval");
    expect(toolNamesFor("chat")).toContain("await_agent_card_approval");
    expect(toolNamesFor("chat")).not.toContain("get_agent_card_request");
    expect(toolNamesFor("chat")).toContain("watch_checkout");
    expect(toolNamesFor("mcp")).not.toContain("watch_checkout");
    expect(toolNamesFor("chat")).toContain("pay_checkout_with_agent_card");
    expect(toolNamesFor("chat")).toContain("save_buyer_profile");
    for (const name of ["await_buyer_details", "await_payment_choice"] as const) {
      expect(toolNamesFor("chat")).toContain(name);
      expect(toolNamesFor("mcp")).not.toContain(name);
    }
    expect(toolNamesFor("chat")).toContain("search_products");
    expect(toolNamesFor("chat")).toContain("look_up_products");
    expect(toolNamesFor("chat")).toContain("show_receipt");
    expect(toolNamesFor("mcp")).not.toContain("show_receipt");
    for (const name of ["create_checkout", "answer_checkout", "reveal_agent_card"] as const) {
      expect(toolNamesFor("mcp")).toContain(name);
      expect(toolNamesFor("chat")).toContain(name);
    }
  });
  it("composes the shared summary with a surface addendum", () => {
    expect(describeTool("cancel_checkout")).toBe(TOOL_DOCS.cancel_checkout.summary);
    expect(describeTool("request_agent_card", "Show the URL.")).toBe(`${TOOL_DOCS.request_agent_card.summary} Show the URL.`);
    expect(paramDoc("create_checkout", "maxCost")).toContain("Enforced");
  });
});
