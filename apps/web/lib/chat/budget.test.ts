import { describe, expect, it } from "vitest";
import { budgetAmounts, parseBudgetAmount } from "./budget";
import { budgetFor, parsePrice } from "./payment-choice";

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
    expect(parseBudgetAmount("10.005", "USD")).toHaveProperty("problem");
  });

  it("accepts zero-padded decimals the currency does not show", () => {
    expect(parseBudgetAmount("10000.00", "CLP")).toEqual({
      amount: { value: "10000", currency: "CLP" },
    });
  });

  it("reads a comma followed by three digits as a thousands separator", () => {
    expect(parseBudgetAmount("10,000", "KWD")).toEqual({
      amount: { value: "10000.000", currency: "KWD" },
    });
    expect(parseBudgetAmount("1,234", "USD")).toEqual({
      amount: { value: "1234.00", currency: "USD" },
    });
  });

  it("reads a comma followed by fewer digits as a decimal point", () => {
    expect(parseBudgetAmount("10,50", "USD")).toEqual({
      amount: { value: "10.50", currency: "USD" },
    });
  });

  it("keeps USD at two decimals", () => {
    expect(parseBudgetAmount("75", "USD")).toEqual({
      amount: { value: "75.00", currency: "USD" },
    });
  });
});

describe("parsePrice", () => {
  it("parses catalog prices with up to four decimals", () => {
    expect(parsePrice("35.99 USD")).toEqual({ amount: "35.99", currency: "USD" });
    expect(parsePrice("1.250 KWD")).toEqual({ amount: "1.250", currency: "KWD" });
    expect(parsePrice("1.2345 CLF")).toEqual({ amount: "1.2345", currency: "CLF" });
    expect(parsePrice("1.23456 CLF")).toBeUndefined();
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

  it("formats a three-decimal price and budget", () => {
    expect(budgetFor({ amount: "1.250", currency: "KWD" })).toEqual({
      value: "12.000",
      currency: "KWD",
    });
  });

  it("falls back to two decimals for a currency code it does not know", () => {
    expect(budgetFor({ amount: "100", currency: "ZZZ" })).toEqual({
      value: "125.00",
      currency: "ZZZ",
    });
    expect(budgetAmounts("ZZZ").map((m) => m.value)).toEqual(["20.00", "50.00", "100.00"]);
    expect(parseBudgetAmount("75", "ZZZ")).toEqual({
      amount: { value: "75.00", currency: "ZZZ" },
    });
  });
});
