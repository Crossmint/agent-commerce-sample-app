import { describe, expect, it } from "vitest";
import { declineResponse, pendingActionOf, receiptOf, submitResponse } from "../src/checkout-messages.js";
import { isPaymentAction, renderPendingAction } from "../src/pending-action.js";
import type { Checkout } from "../src/types.js";

const shipping = {
  id: "req_1",
  question: "Where should we ship this?",
  expiresAt: "2026-09-18T10:00:00.000Z",
  responseSchema: {
    type: "object",
    required: ["fullName"],
    properties: {
      fullName: { type: "string", title: "Full name" },
      country: { type: "string", enum: ["US", "GB"] },
      express: { type: "boolean" },
    },
  },
};

describe("renderPendingAction", () => {
  it("walks properties into fields and titles the form with the question", () => {
    const r = renderPendingAction(shipping);
    expect(r.id).toBe("req_1");
    expect(r.title).toBe("Where should we ship this?");
    expect(r.expiresAt).toBe(shipping.expiresAt);
    expect(r.fields.map((f) => f.name)).toEqual(["fullName", "country", "express"]);
    expect(r.fields[0]?.required).toBe(true);
    expect(r.fields[1]?.kind).toBe("select");
    expect(r.fields[2]?.kind).toBe("boolean");
    expect(isPaymentAction(shipping)).toBe(false);
  });
  it("detects and fills payment requests", () => {
    const pay = {
      id: "req_2",
      question: "Enter the card to pay with",
      responseSchema: {
        type: "object",
        properties: {
          cardNumber: { type: "string" },
          expMonth: { type: "string" },
          expYear: { type: "string" },
          cvc: { type: "string" },
        },
      },
    };
    expect(isPaymentAction(pay)).toBe(true);
    // The payment step as Agent Checkouts sends it now: no fields, an amount to authorize.
    const step = {
      id: "p",
      question: "Authorize a card payment of 42.50 USD at shop.example.com.",
      responseSchema: {},
      payment: { method: "card", amount: { kind: "exact", value: "42.50", currency: "USD" }, merchant: { domain: "shop.example.com" } },
    };
    expect(isPaymentAction(step)).toBe(true);
  });
  it("does not call a card choice a payment form", () => {
    const pick = { id: "r", question: "Which saved card should I use?", responseSchema: { type: "object", properties: { card: { type: "string", enum: ["visa-4242", "amex-0005"] } } } };
    expect(isPaymentAction(pick)).toBe(false);
  });
});

describe("checkout run helpers", () => {
  const base = { runId: "run_1", revision: 3, createdAt: "2026-09-17T00:00:00Z", input: { request: { startUrl: "https://shop.example/p" }, constraints: { maxCost: { amount: "10.00", currency: "USD" } } } };
  it("flattens requiredAction into a pending action only while awaiting input", () => {
    const awaiting: Checkout = {
      ...base,
      status: "awaiting_input",
      requiredAction: {
        type: "input_response",
        requestId: "req_9",
        messageId: "msg_9",
        request: { question: "Size?", expiresAt: "2026-09-18T00:00:00Z", interaction: { kind: "form", responseSchema: { type: "object", properties: { size: { enum: ["s", "m"] } } }, uiSchema: {} } },
      },
    };
    expect(pendingActionOf(awaiting)).toMatchObject({ id: "req_9", messageId: "msg_9", question: "Size?", responseSchema: { properties: { size: { enum: ["s", "m"] } } } });
    expect(pendingActionOf({ ...awaiting, status: "running" })).toBeUndefined();
    expect(pendingActionOf({ ...base, status: "running", requiredAction: null })).toBeUndefined();
  });
  it("reads the receipt from a captured purchase", () => {
    const done: Checkout = { ...base, status: "succeeded", result: { outcome: "succeeded", summary: "Bought.", purchase: { kind: "receipt_captured", receipt: { total: { amount: "9.50", currency: "USD" }, merchantOrderId: "ord_1" } } } };
    expect(receiptOf(done)).toEqual({ total: { amount: "9.50", currency: "USD" }, merchantOrderId: "ord_1" });
    expect(receiptOf({ result: { outcome: "succeeded", summary: "Bought.", purchase: { kind: "confirmed_without_receipt" } } })).toBeUndefined();
  });
  it("builds input_response parts", () => {
    expect(submitResponse("req_1", { size: "m" })).toEqual({ type: "input_response", requestId: "req_1", action: "submit", response: { kind: "form", values: { size: "m" } } });
    expect(declineResponse("req_1")).toEqual({ type: "input_response", requestId: "req_1", action: "decline" });
  });
});
