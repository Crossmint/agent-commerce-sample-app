import { describe, expect, it } from "vitest";
import { fillPaymentAction, isPaymentAction, renderPendingAction } from "../src/pending-action.js";

const shipping = {
  id: "act_1",
  type: "shipping",
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
  it("walks properties into fields", () => {
    const r = renderPendingAction(shipping);
    expect(r.fields.map((f) => f.name)).toEqual(["fullName", "country", "express"]);
    expect(r.fields[0]?.required).toBe(true);
    expect(r.fields[1]?.kind).toBe("select");
    expect(r.fields[2]?.kind).toBe("boolean");
    expect(isPaymentAction(shipping)).toBe(false);
  });
  it("detects and fills payment actions", () => {
    const pay = {
      id: "act_2",
      type: "payment",
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
    expect(
      fillPaymentAction(pay, { number: "4111", expirationMonth: "12", expirationYear: "2030", cvc: "123" }),
    ).toEqual({ cardNumber: "4111", expMonth: "12", expYear: "2030", cvc: "123" });
    const camel = { id: "a", type: "payment", responseSchema: { type: "object", properties: { number: {}, expiryMonth: {}, expiryYear: {}, cvv: {} } } };
    expect(fillPaymentAction(camel, { number: "4", expirationMonth: "01", expirationYear: "2031", cvc: "9" })).toEqual({ number: "4", expiryMonth: "01", expiryYear: "2031", cvv: "9" });
  });
});
