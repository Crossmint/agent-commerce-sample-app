import { describe, expect, it } from "vitest";
import { buyerProfileProblems, normalizeBuyerProfile } from "../src/buyer-profile.js";
import type { BuyerProfileInput } from "../src/types.js";

const good: BuyerProfileInput = {
  label: "Home",
  name: { first: "Ada", last: "Lovelace" },
  contact: { email: "ada@example.com", phone: "+1 (415) 555-0100" },
  shipping: {
    addressLines: ["1 Main St"],
    locality: "Springfield",
    administrativeAreaCode: "US-IL",
    postalCode: "62701",
    countryCode: "US",
  },
};

const with_ = (change: {
  name?: Partial<BuyerProfileInput["name"]>;
  contact?: Partial<BuyerProfileInput["contact"]>;
  shipping?: Partial<BuyerProfileInput["shipping"]>;
}): BuyerProfileInput => ({
  ...good,
  name: { ...good.name, ...change.name },
  contact: { ...good.contact, ...change.contact },
  shipping: { ...good.shipping, ...change.shipping },
});

const fields = (input: BuyerProfileInput, opts?: { requirePhone?: boolean }) =>
  buyerProfileProblems(normalizeBuyerProfile(input), opts).map((p) => p.field);

describe("normalizeBuyerProfile", () => {
  it("trims, drops empty parts, and writes the state as ISO 3166-2", () => {
    const out = normalizeBuyerProfile({
      label: " Home ",
      name: { first: " Ada ", last: "Lovelace " },
      contact: { email: " ada@example.com ", phone: "  " },
      shipping: {
        addressLines: [" 1 Main St ", "  "],
        locality: " Springfield ",
        administrativeAreaCode: " il ",
        postalCode: " 62701 ",
        countryCode: "us",
      },
    });
    expect(out).toEqual({
      label: "Home",
      name: { first: "Ada", last: "Lovelace" },
      contact: { email: "ada@example.com" },
      shipping: {
        addressLines: ["1 Main St"],
        locality: "Springfield",
        administrativeAreaCode: "US-IL",
        postalCode: "62701",
        countryCode: "US",
      },
    });
  });

  it("keeps a state that already names its country", () => {
    expect(
      normalizeBuyerProfile(with_({ shipping: { administrativeAreaCode: "us-ca" } })).shipping,
    ).toMatchObject({ administrativeAreaCode: "US-CA" });
  });
});

describe("buyerProfileProblems", () => {
  it("passes good US, Canadian and other addresses", () => {
    expect(fields(good, { requirePhone: true })).toEqual([]);
    expect(
      fields(
        with_({
          shipping: { administrativeAreaCode: "ON", postalCode: "k1a0b1", countryCode: "CA" },
        }),
      ),
    ).toEqual([]);
    expect(
      fields(
        with_({
          shipping: {
            administrativeAreaCode: undefined,
            postalCode: "SW1A 1AA",
            countryCode: "GB",
          },
        }),
      ),
    ).toEqual([]);
  });

  it("names every blank field, spaces included", () => {
    const blank = with_({
      name: { first: " ", last: "" },
      contact: { email: "  ", phone: "" },
      shipping: { addressLines: [" "], locality: "", postalCode: " " },
    });
    expect(fields(blank, { requirePhone: true })).toEqual([
      "firstName",
      "lastName",
      "email",
      "phone",
      "addressLine1",
      "city",
      "postalCode",
    ]);
  });

  it("asks for a phone only when told to", () => {
    const noPhone = with_({ contact: { phone: undefined } });
    expect(fields(noPhone)).toEqual([]);
    expect(fields(noPhone, { requirePhone: true })).toEqual(["phone"]);
  });

  it("checks the email and phone formats", () => {
    expect(fields(with_({ contact: { email: "ada@example" } }))).toEqual(["email"]);
    expect(fields(with_({ contact: { phone: "12345" } }))).toEqual(["phone"]);
    expect(fields(with_({ contact: { phone: "call me" } }))).toEqual(["phone"]);
    expect(fields(with_({ contact: { phone: "+44 20 7946 0958" } }))).toEqual([]);
  });

  it("wants a real state and ZIP code in the US", () => {
    expect(fields(with_({ shipping: { administrativeAreaCode: undefined } }))).toEqual(["region"]);
    expect(fields(with_({ shipping: { administrativeAreaCode: "XX" } }))).toEqual(["region"]);
    expect(fields(with_({ shipping: { postalCode: "6270" } }))).toEqual(["postalCode"]);
    expect(fields(with_({ shipping: { postalCode: "62701-1234" } }))).toEqual([]);
  });

  it("refuses a state from another country", () => {
    const problems = buyerProfileProblems(
      normalizeBuyerProfile(with_({ shipping: { administrativeAreaCode: "CA-ON" } })),
    );
    expect(problems).toEqual([
      { field: "region", message: "That state or province is not in US." },
    ]);
  });

  it("refuses a country code that names no country", () => {
    expect(
      fields(with_({ shipping: { administrativeAreaCode: undefined, countryCode: "USA" } })),
    ).toContain("countryCode");
    expect(
      fields(with_({ shipping: { administrativeAreaCode: undefined, countryCode: "QQ" } })),
    ).toContain("countryCode");
  });
});
