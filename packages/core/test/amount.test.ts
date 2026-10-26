import { describe, expect, it } from "vitest";
import { currencyFractionDigits, significantDecimals, toDecimalString } from "../src/amount.js";

describe("currencyFractionDigits", () => {
  it("returns the currency's decimals", () => {
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("CLP")).toBe(0);
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(currencyFractionDigits("KWD")).toBe(3);
    expect(currencyFractionDigits("BHD")).toBe(3);
  });

  it("uses ISO minor units where CLDR display digits differ", () => {
    expect(currencyFractionDigits("COP")).toBe(2);
    expect(currencyFractionDigits("HUF")).toBe(2);
    expect(currencyFractionDigits("IDR")).toBe(2);
    expect(currencyFractionDigits("PKR")).toBe(2);
    expect(currencyFractionDigits("TWD")).toBe(2);
    expect(currencyFractionDigits("MGA")).toBe(2);
    expect(currencyFractionDigits("MRU")).toBe(2);
    expect(currencyFractionDigits("IQD")).toBe(3);
  });

  it("throws on an unknown currency", () => {
    expect(() => currencyFractionDigits("ZZZ")).toThrow(/Unknown currency/);
  });

  it("returns the fallback for an unknown currency instead", () => {
    expect(currencyFractionDigits("ZZZ", 2)).toBe(2);
  });
});

describe("significantDecimals", () => {
  it("ignores trailing zeros", () => {
    expect(significantDecimals("10000.00")).toBe(0);
    expect(significantDecimals("1.250")).toBe(2);
    expect(significantDecimals("1.25")).toBe(2);
    expect(significantDecimals("10000.5")).toBe(1);
    expect(significantDecimals("10")).toBe(0);
  });
});

describe("toDecimalString", () => {
  it("formats with the currency's decimals", () => {
    expect(toDecimalString(10000, "CLP")).toBe("10000");
    expect(toDecimalString("500", "JPY")).toBe("500");
    expect(toDecimalString(5.5, "USD")).toBe("5.50");
    expect(toDecimalString(1.25, "KWD")).toBe("1.250");
  });

  it("pads shorter input instead of shrinking it", () => {
    expect(toDecimalString("1.2", "KWD")).toBe("1.200");
    expect(toDecimalString("50", "USD")).toBe("50.00");
  });

  it("accepts zero-padded input beyond the decimals", () => {
    expect(toDecimalString("10000.00", "CLP")).toBe("10000");
  });

  it("formats currencies CLDR shows without decimals at their ISO minor units", () => {
    expect(toDecimalString(50000, "COP")).toBe("50000.00");
    expect(toDecimalString("1500", "IQD")).toBe("1500.000");
  });

  it("throws on a non-zero digit past the currency's decimals", () => {
    expect(() => toDecimalString("10000.5", "CLP")).toThrow(/more decimals/);
    expect(() => toDecimalString("1.234", "USD")).toThrow(/more decimals/);
  });

  it("throws on a fractional unit at any magnitude", () => {
    expect(() => toDecimalString("500000000.5", "CLP")).toThrow(/more decimals/);
    expect(() => toDecimalString(500000000.5, "CLP")).toThrow(/more decimals/);
  });

  it("accepts float dust from number arithmetic", () => {
    expect(toDecimalString(0.1 + 0.2, "USD")).toBe("0.30");
  });

  it("throws on an unknown currency", () => {
    expect(() => toDecimalString(10, "ZZZ")).toThrow(/Unknown currency/);
  });

  it("still rejects bad input", () => {
    expect(() => toDecimalString(-5, "USD")).toThrow(/Invalid amount/);
    expect(() => toDecimalString("abc", "USD")).toThrow(/Invalid amount/);
    expect(() => toDecimalString("", "USD")).toThrow(/Invalid amount/);
  });
});
