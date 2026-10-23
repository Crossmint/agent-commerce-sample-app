import { describe, expect, it } from "vitest";
import { CrossmintApiError } from "../src/errors.js";

describe("CrossmintApiError", () => {
  it("reads a top-level message", () => {
    const err = new CrossmintApiError({
      status: 502,
      url: "https://api.test/x",
      body: { error: true, message: "The order intent provider could not process the request" },
    });
    expect(err.message).toBe("The order intent provider could not process the request");
  });

  it("reads a message nested under error", () => {
    const err = new CrossmintApiError({
      status: 502,
      url: "https://api.test/x",
      body: { error: { code: "ORDER_INTENT_PROVIDER_ERROR", message: "provider failed" } },
    });
    expect(err.message).toBe("provider failed");
  });

  it("reads a message nested under a provider object", () => {
    const err = new CrossmintApiError({
      status: 502,
      url: "https://api.test/x",
      body: { provider: { message: "basis theory rejected the amount" } },
    });
    expect(err.message).toBe("basis theory rejected the amount");
  });

  it("falls back to the status when the body has no message", () => {
    const err = new CrossmintApiError({ status: 502, url: "https://api.test/x", body: {} });
    expect(err.message).toBe("Crossmint request failed with 502");
    const plain = new CrossmintApiError({
      status: 502,
      url: "https://api.test/x",
      body: "Bad Gateway",
    });
    expect(plain.message).toBe("Crossmint request failed with 502");
  });
});
