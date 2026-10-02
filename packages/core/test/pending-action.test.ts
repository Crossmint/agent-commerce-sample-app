import { describe, expect, it } from "vitest";
import { declineResponse, pendingActionOf, receiptOf, submitResponse } from "../src/checkout-messages.js";
import {
  asksCardInForm,
  asksPasswordInForm,
  isPaymentAction,
  isProtectedAction,
  protectedFields,
  renderPendingAction,
} from "../src/pending-action.js";
import type { Checkout, CheckoutField, PendingUserAction } from "../src/types.js";

const text = (key: string, label: string, extra: Partial<Extract<CheckoutField["input"], { kind: "text" }>> = {}): CheckoutField => ({
  key,
  label,
  required: true,
  handling: "standard",
  input: { kind: "text", ...extra },
});

const option = (value: string, extra: { selected?: boolean; placeholder?: boolean; disabled?: boolean } = {}) => ({
  value,
  label: value.toUpperCase(),
  disabled: extra.disabled ?? false,
  selected: extra.selected ?? false,
  placeholder: extra.placeholder ?? false,
});

const password: CheckoutField = {
  key: "password",
  label: "Password",
  required: true,
  handling: "protected",
  input: { kind: "text", display: "masked", autoComplete: "current-password" },
};

const action = (fields: CheckoutField[], extra: Partial<PendingUserAction> = {}): PendingUserAction => ({
  id: "req_1",
  question: "Where should we ship this?",
  expiresAt: "2026-09-18T10:00:00.000Z",
  fields,
  ...extra,
});

describe("renderPendingAction", () => {
  it("lists the fields in order and titles the form with the question", () => {
    const shipping = action([
      text("fullName", "Full name"),
      {
        key: "country",
        label: "Country",
        required: false,
        handling: "standard",
        input: { kind: "choice", selection: { kind: "one" }, options: [option("", { placeholder: true }), option("US", { selected: true }), option("GB")] },
      },
      { key: "express", label: "Express", required: false, handling: "standard", input: { kind: "boolean" } },
      { key: "quantity", label: "Quantity", required: true, handling: "standard", input: { kind: "integer" } },
    ]);
    const r = renderPendingAction(shipping);
    expect(r.id).toBe("req_1");
    expect(r.title).toBe("Where should we ship this?");
    expect(r.expiresAt).toBe(shipping.expiresAt);
    expect(r.fields.map((f) => [f.name, f.kind])).toEqual([
      ["fullName", "text"],
      ["country", "select"],
      ["express", "boolean"],
      ["quantity", "number"],
    ]);
    expect(r.fields[0]?.required).toBe(true);
    // The placeholder option is never an answer; the preselected one is the default.
    expect(r.fields[1]?.options?.map((o) => o.value)).toEqual(["US", "GB"]);
    expect(r.fields[1]?.default).toBe("US");
    expect(r.fields[3]?.integer).toBe(true);
    expect(isPaymentAction(shipping)).toBe(false);
  });
  it("renders a choice of many with its bounds", () => {
    const r = renderPendingAction(
      action([
        {
          key: "toppings",
          label: "Toppings",
          required: true,
          handling: "standard",
          input: { kind: "choice", selection: { kind: "many", min: 1, max: 2 }, options: [option("a"), option("b"), option("c", { disabled: true })] },
        },
      ]),
    );
    expect(r.fields[0]).toMatchObject({ kind: "multiselect", min: 1, max: 2 });
    expect(r.fields[0]?.options?.[2]).toEqual({ value: "c", label: "C", disabled: true });
  });
  it("keeps a locked option: the answer to a choice of one, fixed in a choice of many", () => {
    const locked = [option("std", { selected: true, disabled: true }), option("express"), option("gone", { disabled: true })];
    const r = renderPendingAction(
      action([
        { key: "ship", label: "Shipping", required: true, handling: "standard", input: { kind: "choice", selection: { kind: "one" }, options: locked } },
        { key: "extras", label: "Extras", required: true, handling: "standard", input: { kind: "choice", selection: { kind: "many", min: 1 }, options: locked } },
      ]),
    );
    expect(r.fields[0]).toMatchObject({ default: "std", options: [{ value: "std", label: "STD" }, { value: "express", label: "EXPRESS" }, { value: "gone", label: "GONE", disabled: true }] });
    expect(r.fields[0]?.options?.[0]?.disabled).toBeUndefined();
    expect(r.fields[1]).toMatchObject({ default: ["std"], options: [{ value: "std", disabled: true }, { value: "express" }, { value: "gone", disabled: true }] });
  });
  it("keeps a protected field's descriptor for Crossmint's protected field, unchanged", () => {
    const r = renderPendingAction(action([text("email", "Email"), password]));
    expect(r.fields[1]).toEqual({ name: "password", label: "Password", required: true, kind: "protected", protectedField: password });
  });
  it("detects payment requests", () => {
    const pay = action(["cardNumber", "expMonth", "expYear", "cvc"].map((k) => text(k, k)));
    expect(isPaymentAction(pay)).toBe(true);
    expect(asksCardInForm(pay)).toBe(true);
    // The payment step as Agent Checkouts sends it: no fields, an amount to authorize.
    const step = action([], {
      payment: {
        method: "card",
        amount: { kind: "exact", value: "42.50", currency: "USD" },
        merchant: { name: "Shop", url: "https://shop.example.com", countryCode: "US" },
      },
    });
    expect(isPaymentAction(step)).toBe(true);
    expect(asksCardInForm(step)).toBe(false);
  });
  it("does not call a card choice a payment form", () => {
    const pick = action([
      { key: "card", label: "Which saved card?", required: true, handling: "standard", input: { kind: "choice", selection: { kind: "one" }, options: [option("visa-4242"), option("amex-0005")] } },
    ]);
    expect(isPaymentAction(pick)).toBe(false);
  });
});

describe("checkout run helpers", () => {
  const base = { runId: "run_1", revision: 3, createdAt: "2026-09-17T00:00:00Z", input: { request: { startUrl: "https://shop.example/p" }, constraints: { maxCost: { amount: "10.00", currency: "USD" } } } };
  it("flattens requiredAction into a pending action only while awaiting input", () => {
    const size: CheckoutField = { key: "size", label: "Size", required: true, handling: "standard", input: { kind: "choice", selection: { kind: "one" }, options: [option("s"), option("m")] } };
    const awaiting: Checkout = {
      ...base,
      status: "awaiting_input",
      requiredAction: {
        type: "input_response",
        requestId: "req_9",
        messageId: "msg_9",
        request: { question: "Size?", expiresAt: "2026-09-18T00:00:00Z", interaction: { kind: "form", fields: [size] } },
      },
    };
    expect(pendingActionOf(awaiting)).toEqual({ id: "req_9", messageId: "msg_9", question: "Size?", expiresAt: "2026-09-18T00:00:00Z", fields: [size] });
    expect(pendingActionOf({ ...awaiting, status: "running" })).toBeUndefined();
    expect(pendingActionOf({ ...base, status: "running", requiredAction: null })).toBeUndefined();
  });
  it("flattens the payment step with no fields", () => {
    const merchant = { name: "Shop", url: "https://shop.example", countryCode: "US" };
    const amount = { kind: "exact", value: "9.50", currency: "USD" };
    const pay = pendingActionOf({
      ...base,
      status: "awaiting_input",
      requiredAction: {
        type: "input_response",
        requestId: "req_pay",
        messageId: "msg_pay",
        request: { question: "Pay?", expiresAt: "2026-09-18T00:00:00Z", interaction: { kind: "payment", purpose: "checkout_payment", method: "card", amount, merchant } },
      },
    })!;
    expect(pay.fields).toEqual([]);
    expect(pay.payment).toEqual({ method: "card", amount, merchant });
  });
  it("marks a form with a protected field as protected", () => {
    const signIn = action([text("email", "Email"), password]);
    expect(isProtectedAction(signIn)).toBe(true);
    expect(protectedFields(signIn)).toEqual([password]);
    expect(isProtectedAction(action([text("email", "Email")]))).toBe(false);
    // A protected password is the right way to ask; it is not a password in a plain form.
    expect(asksPasswordInForm(signIn)).toBe(false);
  });
  it("spots a standard field that holds a password, and nothing else", () => {
    expect(asksPasswordInForm(action([text("amazon_password", "Amazon account password")]))).toBe(true);
    expect(asksPasswordInForm(action([text("secret", "Contraseña")]))).toBe(true);
    expect(asksPasswordInForm(action([text("secret", "Secret", { display: "masked" })]))).toBe(true);
    expect(asksPasswordInForm(action([text("secret", "Secret", { autoComplete: "current-password" })]))).toBe(true);
    // A choice of sign-in method is not the secret itself.
    const method: CheckoutField = { key: "amazon_auth_method", label: "Password or passkey?", required: true, handling: "standard", input: { kind: "choice", selection: { kind: "one" }, options: [option("password"), option("passkey")] } };
    expect(asksPasswordInForm(action([method]))).toBe(false);
    expect(asksPasswordInForm(action([text("email", "Account email")]))).toBe(false);
  });
  it("reads the receipt from a captured purchase", () => {
    const done: Checkout = { ...base, status: "succeeded", result: { outcome: "succeeded", summary: "Bought.", purchase: { kind: "receipt_captured", receipt: { total: { amount: "9.50", currency: "USD" }, merchantOrderId: "ord_1" } } } };
    expect(receiptOf(done)).toEqual({ total: { amount: "9.50", currency: "USD" }, merchantOrderId: "ord_1" });
    expect(receiptOf({ result: { outcome: "succeeded", summary: "Bought.", purchase: { kind: "confirmed_without_receipt" } } })).toBeUndefined();
  });
  it("builds input_response parts", () => {
    expect(submitResponse("req_1", { email: "a@b.co", password: { protectedInputId: "pi_1" } })).toEqual({
      type: "input_response",
      requestId: "req_1",
      action: "submit",
      response: { kind: "form", answers: { email: "a@b.co", password: { protectedInputId: "pi_1" } } },
    });
    expect(declineResponse("req_1")).toEqual({ type: "input_response", requestId: "req_1", action: "decline" });
  });
});
