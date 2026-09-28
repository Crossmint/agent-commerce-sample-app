import type { BuyerProfileInput } from "./types.js";

/**
 * Checks for buyer details, shared by every place that saves them: the form
 * in the app, the chat agent's save tool and the server route. Each problem
 * names its field, so a form can show it under that field, and says what to
 * type in words a user can act on, so an agent can repeat it as is.
 *
 * The checks are for what stores need to ship an order, not a full address
 * validator: a US or Canadian address gets its real state, province and
 * postal code formats; every other country gets looser rules.
 */

/** A field of the buyer details, as the checks name it. */
export type BuyerProfileField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "addressLine1"
  | "city"
  | "region"
  | "postalCode"
  | "countryCode";

/** One thing wrong with the buyer details. */
export interface BuyerProfileProblem {
  field: BuyerProfileField;
  message: string;
}

export interface BuyerProfileCheckOptions {
  /** Treat a missing phone number as a problem. The form and the chat ask for one; the API does not. */
  requirePhone?: boolean;
}

const US_STATES = new Set(
  (
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND " +
    "OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AS GU MP PR VI UM AA AE AP"
  ).split(" "),
);
const CA_PROVINCES = new Set("AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" "));

/** Countries whose stores always ask for a state or province. */
const REGIONS: Record<string, { name: string; codes: Set<string>; example: string }> = {
  US: { name: "state", codes: US_STATES, example: "CA" },
  CA: { name: "province", codes: CA_PROVINCES, example: "ON" },
};

const POSTAL_CODES: Record<string, { pattern: RegExp; message: string }> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, message: "Enter a 5-digit ZIP code, such as 94103." },
  CA: { pattern: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/, message: "Enter a postal code such as K1A 0B1." },
};
const ANY_POSTAL_CODE = /^[A-Z0-9][A-Z0-9 -]{1,9}$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

/**
 * Buyer details as they should be saved: every field trimmed, empty address
 * lines and an empty phone dropped, codes in capitals, and the state written
 * as ISO 3166-2 ("CA" in the US becomes "US-CA"), the form Crossmint wants.
 */
export function normalizeBuyerProfile(input: BuyerProfileInput): BuyerProfileInput {
  const countryCode = input.shipping.countryCode.trim().toUpperCase();
  const region = input.shipping.administrativeAreaCode?.trim().toUpperCase().replace(/\s+/g, "");
  const phone = input.contact.phone?.trim();
  const postalCode = input.shipping.postalCode.trim().toUpperCase().replace(/\s+/g, " ");
  return {
    label: input.label.trim(),
    name: { first: input.name.first.trim(), last: input.name.last.trim() },
    contact: { email: input.contact.email.trim(), ...(phone ? { phone } : {}) },
    shipping: {
      addressLines: input.shipping.addressLines.map((line) => line.trim()).filter(Boolean),
      locality: input.shipping.locality.trim(),
      ...(region
        ? { administrativeAreaCode: region.includes("-") ? region : `${countryCode}-${region}` }
        : {}),
      postalCode,
      countryCode,
    },
  };
}

/**
 * What is wrong with the buyer details, field by field. Empty when they can
 * be saved. Pass the output of `normalizeBuyerProfile`.
 */
export function buyerProfileProblems(
  input: BuyerProfileInput,
  opts: BuyerProfileCheckOptions = {},
): BuyerProfileProblem[] {
  const problems: BuyerProfileProblem[] = [];
  const add = (field: BuyerProfileField, message: string) => problems.push({ field, message });
  const { name, contact, shipping } = input;
  const country = shipping.countryCode;

  if (!name.first) add("firstName", "Enter a first name.");
  if (!name.last) add("lastName", "Enter a last name.");

  if (!contact.email) add("email", "Enter an email address.");
  else if (!EMAIL.test(contact.email))
    add("email", "Enter an email address such as name@example.com.");

  if (!contact.phone) {
    if (opts.requirePhone) add("phone", "Enter a phone number. Stores use it for the delivery.");
  } else {
    const digits = contact.phone.replace(/\D/g, "").length;
    if (!PHONE_CHARACTERS.test(contact.phone) || digits < 7 || digits > 15) {
      add("phone", "Enter a phone number with 7 to 15 digits, such as +1 415 555 0100.");
    }
  }

  if (!shipping.addressLines.length) add("addressLine1", "Enter a street address.");
  if (!shipping.locality) add("city", "Enter a city.");

  const knownCountry = isCountryCode(country);
  if (!knownCountry) add("countryCode", "Enter a two-letter country code, such as US.");

  const regionRule = REGIONS[country];
  const code = shipping.administrativeAreaCode;
  const [prefix, subdivision] = code ? code.split("-", 2) : [];
  if (code && prefix !== country) {
    if (knownCountry) add("region", `That state or province is not in ${country}.`);
  } else if (regionRule) {
    if (!subdivision) add("region", `Enter a ${regionRule.name}, such as ${regionRule.example}.`);
    else if (!regionRule.codes.has(subdivision)) {
      add("region", `Enter a two-letter ${regionRule.name} code, such as ${regionRule.example}.`);
    }
  } else if (subdivision && !/^[A-Z0-9]{1,3}$/.test(subdivision)) {
    add("region", "Enter the state or province as a short code of up to 3 letters or digits.");
  }

  const postalRule = POSTAL_CODES[country];
  if (!shipping.postalCode) add("postalCode", "Enter a ZIP or postal code.");
  else if (postalRule && !postalRule.pattern.test(shipping.postalCode)) {
    add("postalCode", postalRule.message);
  } else if (!postalRule && !ANY_POSTAL_CODE.test(shipping.postalCode)) {
    add("postalCode", "Enter a postal code of 2 to 10 letters or digits.");
  }

  return problems;
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  } catch {
    return undefined;
  }
})();

/** Two capital letters that name a country, by the runtime's ISO 3166-1 data where it has it. */
function isCountryCode(code: string): boolean {
  if (!/^[A-Z]{2}$/.test(code)) return false;
  if (!regionNames) return true;
  try {
    return regionNames.of(code) !== undefined;
  } catch {
    return false;
  }
}
