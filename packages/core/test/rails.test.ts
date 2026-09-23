import { describe, expect, it } from "vitest";
import {
  needsCvcRecollection,
  pendingCvcRecollectionRails,
  pendingVerificationRails,
  selectRail,
} from "../src/rails.js";
import type { OrderIntentRail } from "../src/types.js";

const vicPending: OrderIntentRail = { rail: "agentic-token", provider: "vic", status: "pending_verification" };
const vicActive: OrderIntentRail = { rail: "agentic-token", provider: "vic", status: "active" };
const enc: OrderIntentRail = { rail: "encrypted-card", status: "active" };
const spt: OrderIntentRail = { rail: "spt", provider: "stripe", status: "active" };
const encNeedsCvc: OrderIntentRail = { rail: "encrypted-card", status: "pending_cvc_recollection" };

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
  it("never selects a rail waiting on the security code", () => {
    expect(selectRail({ rails: [encNeedsCvc] })).toBeNull();
    // A live network rail still pays, so the lapsed code is not the whole card.
    expect(selectRail({ rails: [encNeedsCvc, vicActive] })?.rail.rail).toBe("agentic-token");
  });
  it("lists rails waiting on the security code", () => {
    expect(pendingCvcRecollectionRails({ rails: [encNeedsCvc, vicActive] })).toEqual([encNeedsCvc]);
    expect(pendingCvcRecollectionRails({ rails: [enc, vicActive] })).toEqual([]);
  });
  it("asks for the security code only when nothing else on the card pays", () => {
    expect(needsCvcRecollection({ rails: [encNeedsCvc] })).toBe(true);
    // A live network rail pays without the fallback, so the stale code is not
    // the user's problem yet and nothing asks about it.
    expect(needsCvcRecollection({ rails: [encNeedsCvc, vicActive] })).toBe(false);
    expect(needsCvcRecollection({ rails: [enc, vicActive] })).toBe(false);
  });
});
