import { describe, expect, it } from "vitest";
import { budgetAmounts, parseBudgetAmount } from "./budget";
import { budgetFor } from "./payment-choice";

describe("budgetAmounts", () => {
  it("formats each option with the currency's decimals", () => {
    expect(budgetAmounts("USD").map((m) => m.value)).toEqual(["20.00", "50.00", "100.00"]);
    expect(budgetAmounts("KWD").map((m) => m.value)).toEqual(["20.000", "50.000", "100.000"]);
    expect(budgetAmounts("CLP", { value: "10000", currency: "CLP" })).toEqual([
      { value: "10000", currency: "CLP" },
    ]);
  });
});

describe("parseBudgetAmount", () => {
  it("emits a zero-decimal currency without decimals", () => {
    expect(parseBudgetAmount("10000", "CLP")).toEqual({
      amount: { value: "10000", currency: "CLP" },
    });
    expect(parseBudgetAmount("500", "JPY")).toEqual({
      amount: { value: "500", currency: "JPY" },
    });
  });

  it("emits a three-decimal currency with three decimals", () => {
    expect(parseBudgetAmount("1.25", "KWD")).toEqual({
      amount: { value: "1.250", currency: "KWD" },
    });
  });

  it("rejects decimals the currency does not allow", () => {
    expect(parseBudgetAmount("10000.5", "CLP")).toHaveProperty("problem");
  });

  it("keeps USD at two decimals", () => {
    expect(parseBudgetAmount("75", "USD")).toEqual({
      amount: { value: "75.00", currency: "USD" },
    });
  });
});

describe("budgetFor", () => {
  it("pads the price into the currency's decimals", () => {
    expect(budgetFor({ amount: "8000", currency: "CLP" })).toEqual({
      value: "10000",
      currency: "CLP",
    });
    expect(budgetFor({ amount: "100", currency: "USD" })).toEqual({
      value: "125.00",
      currency: "USD",
    });
  });
});
