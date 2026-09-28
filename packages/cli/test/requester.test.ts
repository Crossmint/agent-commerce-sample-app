import { describe, expect, it } from "vitest";
import { detectRequester } from "../src/requester.js";

describe("detectRequester", () => {
  it("recognises Claude Code and Codex", () => {
    expect(detectRequester({ CLAUDECODE: "1" }, "h")).toBe("Claude Code");
    expect(detectRequester({ CODEX: "1" }, "h")).toBe("Codex");
  });
  it("falls back to the hostname", () => {
    expect(detectRequester({}, "laptop")).toBe("agent-commerce CLI on laptop");
  });
});
