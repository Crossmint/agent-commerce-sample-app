import { describe, expect, it } from "vitest";
import { selectRail, pendingVerificationRails } from "../src/rails.js";
import type { OrderIntentRail } from "../src/types.js";

const vicPending: OrderIntentRail = { rail: "agentic-token", provider: "vic", status: "pending_verification" };
const vicActive: OrderIntentRail = { rail: "agentic-token", provider: "vic", status: "active" };
const enc: OrderIntentRail = { rail: "encrypted-card", status: "active" };
const spt: OrderIntentRail = { rail: "spt", provider: "stripe", status: "active" };

describe("selectRail", () => {
  it("prefers an active network rail", () => {
    const sel = selectRail({ rails: [enc, vicActive, spt] });
    expect(sel?.rail.rail).toBe("agentic-token");
    expect(sel?.enforced).toBe(true);
  });
  it("never selects the Stripe rail", () => {
    expect(selectRail({ rails: [spt] })).toBeNull();
    expect(selectRail({ rails: [spt, enc] })?.rail.rail).toBe("encrypted-card");
  });
  it("skips rails that are not active", () => {
    const sel = selectRail({ rails: [vicPending, enc] });
    expect(sel?.rail.rail).toBe("encrypted-card");
    expect(sel?.enforced).toBe(false);
  });
  it("returns null when nothing is usable", () => {
    expect(selectRail({ rails: [vicPending] })).toBeNull();
  });
  it("lists rails pending verification", () => {
    expect(pendingVerificationRails({ rails: [vicPending, enc] })).toEqual([vicPending]);
  });
});
