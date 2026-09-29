import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/**
 * Countries and the states or provinces the buyer details form offers as
 * lists. A list, not a text field, is what browser autofill fills best: it
 * picks the option by its code or its name, whichever the saved address
 * holds, so "California" and "CA" both land on CA.
 */

export interface Option {
  code: string;
  name: string;
}

/**
 * Every country by its English name, A to Z: ISO 3166-1 alpha-2, and XK for
 * Kosovo, which stores ship to. Written out rather than read from
 * `Intl.DisplayNames`, whose names differ between the server and the
 * browser and would break hydration.
 */
export const COUNTRIES: Option[] = [
  ["AF", "Afghanistan"],
  ["AX", "Åland Islands"],
  ["AL", "Albania"],
  ["DZ", "Algeria"],
  ["AS", "American Samoa"],
  ["AD", "Andorra"],
  ["AO", "Angola"],
  ["AI", "Anguilla"],
  ["AQ", "Antarctica"],
  ["AG", "Antigua & Barbuda"],
  ["AR", "Argentina"],
  ["AM", "Armenia"],
  ["AW", "Aruba"],
  ["AU", "Australia"],
  ["AT", "Austria"],
  ["AZ", "Azerbaijan"],
  ["BS", "Bahamas"],
  ["BH", "Bahrain"],
  ["BD", "Bangladesh"],
  ["BB", "Barbados"],
  ["BY", "Belarus"],
  ["BE", "Belgium"],
  ["BZ", "Belize"],
  ["BJ", "Benin"],
  ["BM", "Bermuda"],
  ["BT", "Bhutan"],
  ["BO", "Bolivia"],
  ["BA", "Bosnia & Herzegovina"],
  ["BW", "Botswana"],
  ["BV", "Bouvet Island"],
  ["BR", "Brazil"],
  ["IO", "British Indian Ocean Territory"],
  ["VG", "British Virgin Islands"],
  ["BN", "Brunei"],
  ["BG", "Bulgaria"],
  ["BF", "Burkina Faso"],
  ["BI", "Burundi"],
  ["KH", "Cambodia"],
  ["CM", "Cameroon"],
  ["CA", "Canada"],
  ["CV", "Cape Verde"],
  ["BQ", "Caribbean Netherlands"],
  ["KY", "Cayman Islands"],
  ["CF", "Central African Republic"],
  ["TD", "Chad"],
  ["CL", "Chile"],
  ["CN", "China"],
  ["CX", "Christmas Island"],
  ["CC", "Cocos (Keeling) Islands"],
  ["CO", "Colombia"],
  ["KM", "Comoros"],
  ["CD", "Congo (DRC)"],
  ["CG", "Congo (Republic)"],
  ["CK", "Cook Islands"],
  ["CR", "Costa Rica"],
  ["HR", "Croatia"],
  ["CU", "Cuba"],
  ["CW", "Curaçao"],
  ["CY", "Cyprus"],
  ["CZ", "Czechia"],
  ["DK", "Denmark"],
  ["DJ", "Djibouti"],
  ["DM", "Dominica"],
  ["DO", "Dominican Republic"],
  ["EC", "Ecuador"],
  ["EG", "Egypt"],
  ["SV", "El Salvador"],
  ["GQ", "Equatorial Guinea"],
  ["ER", "Eritrea"],
  ["EE", "Estonia"],
  ["SZ", "Eswatini"],
  ["ET", "Ethiopia"],
  ["FK", "Falkland Islands"],
  ["FO", "Faroe Islands"],
  ["FJ", "Fiji"],
  ["FI", "Finland"],
  ["FR", "France"],
  ["GF", "French Guiana"],
  ["PF", "French Polynesia"],
  ["TF", "French Southern Territories"],
  ["GA", "Gabon"],
  ["GM", "Gambia"],
  ["GE", "Georgia"],
  ["DE", "Germany"],
  ["GH", "Ghana"],
  ["GI", "Gibraltar"],
  ["GR", "Greece"],
  ["GL", "Greenland"],
  ["GD", "Grenada"],
  ["GP", "Guadeloupe"],
  ["GU", "Guam"],
  ["GT", "Guatemala"],
  ["GG", "Guernsey"],
  ["GN", "Guinea"],
  ["GW", "Guinea-Bissau"],
  ["GY", "Guyana"],
  ["HT", "Haiti"],
  ["HM", "Heard & McDonald Islands"],
  ["HN", "Honduras"],
  ["HK", "Hong Kong"],
  ["HU", "Hungary"],
  ["IS", "Iceland"],
  ["IN", "India"],
  ["ID", "Indonesia"],
  ["IR", "Iran"],
  ["IQ", "Iraq"],
  ["IE", "Ireland"],
  ["IM", "Isle of Man"],
  ["IL", "Israel"],
  ["IT", "Italy"],
  ["CI", "Ivory Coast"],
  ["JM", "Jamaica"],
  ["JP", "Japan"],
  ["JE", "Jersey"],
  ["JO", "Jordan"],
  ["KZ", "Kazakhstan"],
  ["KE", "Kenya"],
  ["KI", "Kiribati"],
  ["XK", "Kosovo"],
  ["KW", "Kuwait"],
  ["KG", "Kyrgyzstan"],
  ["LA", "Laos"],
  ["LV", "Latvia"],
  ["LB", "Lebanon"],
  ["LS", "Lesotho"],
  ["LR", "Liberia"],
  ["LY", "Libya"],
  ["LI", "Liechtenstein"],
  ["LT", "Lithuania"],
  ["LU", "Luxembourg"],
  ["MO", "Macao"],
  ["MG", "Madagascar"],
  ["MW", "Malawi"],
  ["MY", "Malaysia"],
  ["MV", "Maldives"],
  ["ML", "Mali"],
  ["MT", "Malta"],
  ["MH", "Marshall Islands"],
  ["MQ", "Martinique"],
  ["MR", "Mauritania"],
  ["MU", "Mauritius"],
  ["YT", "Mayotte"],
  ["MX", "Mexico"],
  ["FM", "Micronesia"],
  ["MD", "Moldova"],
  ["MC", "Monaco"],
  ["MN", "Mongolia"],
  ["ME", "Montenegro"],
  ["MS", "Montserrat"],
  ["MA", "Morocco"],
  ["MZ", "Mozambique"],
  ["MM", "Myanmar"],
  ["NA", "Namibia"],
  ["NR", "Nauru"],
  ["NP", "Nepal"],
  ["NL", "Netherlands"],
  ["NC", "New Caledonia"],
  ["NZ", "New Zealand"],
  ["NI", "Nicaragua"],
  ["NE", "Niger"],
  ["NG", "Nigeria"],
  ["NU", "Niue"],
  ["NF", "Norfolk Island"],
  ["KP", "North Korea"],
  ["MK", "North Macedonia"],
  ["MP", "Northern Mariana Islands"],
  ["NO", "Norway"],
  ["OM", "Oman"],
  ["PK", "Pakistan"],
  ["PW", "Palau"],
  ["PS", "Palestine"],
  ["PA", "Panama"],
  ["PG", "Papua New Guinea"],
  ["PY", "Paraguay"],
  ["PE", "Peru"],
  ["PH", "Philippines"],
  ["PN", "Pitcairn Islands"],
  ["PL", "Poland"],
  ["PT", "Portugal"],
  ["PR", "Puerto Rico"],
  ["QA", "Qatar"],
  ["RE", "Réunion"],
  ["RO", "Romania"],
  ["RU", "Russia"],
  ["RW", "Rwanda"],
  ["WS", "Samoa"],
  ["SM", "San Marino"],
  ["ST", "São Tomé & Príncipe"],
  ["SA", "Saudi Arabia"],
  ["SN", "Senegal"],
  ["RS", "Serbia"],
  ["SC", "Seychelles"],
  ["SL", "Sierra Leone"],
  ["SG", "Singapore"],
  ["SX", "Sint Maarten"],
  ["SK", "Slovakia"],
  ["SI", "Slovenia"],
  ["SB", "Solomon Islands"],
  ["SO", "Somalia"],
  ["ZA", "South Africa"],
  ["GS", "South Georgia & South Sandwich Islands"],
  ["KR", "South Korea"],
  ["SS", "South Sudan"],
  ["ES", "Spain"],
  ["LK", "Sri Lanka"],
  ["BL", "St. Barthélemy"],
  ["SH", "St. Helena"],
  ["KN", "St. Kitts & Nevis"],
  ["LC", "St. Lucia"],
  ["MF", "St. Martin"],
  ["PM", "St. Pierre & Miquelon"],
  ["VC", "St. Vincent & Grenadines"],
  ["SD", "Sudan"],
  ["SR", "Suriname"],
  ["SJ", "Svalbard & Jan Mayen"],
  ["SE", "Sweden"],
  ["CH", "Switzerland"],
  ["SY", "Syria"],
  ["TW", "Taiwan"],
  ["TJ", "Tajikistan"],
  ["TZ", "Tanzania"],
  ["TH", "Thailand"],
  ["TL", "Timor-Leste"],
  ["TG", "Togo"],
  ["TK", "Tokelau"],
  ["TO", "Tonga"],
  ["TT", "Trinidad & Tobago"],
  ["TN", "Tunisia"],
  ["TR", "Turkey"],
  ["TM", "Turkmenistan"],
  ["TC", "Turks & Caicos Islands"],
  ["TV", "Tuvalu"],
  ["UM", "U.S. Outlying Islands"],
  ["VI", "U.S. Virgin Islands"],
  ["UG", "Uganda"],
  ["UA", "Ukraine"],
  ["AE", "United Arab Emirates"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["UY", "Uruguay"],
  ["UZ", "Uzbekistan"],
  ["VU", "Vanuatu"],
  ["VA", "Vatican City"],
  ["VE", "Venezuela"],
  ["VN", "Vietnam"],
  ["WF", "Wallis & Futuna"],
  ["EH", "Western Sahara"],
  ["YE", "Yemen"],
  ["ZM", "Zambia"],
  ["ZW", "Zimbabwe"],
].map(([code, name]) => ({ code: code!, name: name! }));

const US_STATES: Option[] = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["AS", "American Samoa"],
  ["GU", "Guam"],
  ["MP", "Northern Mariana Islands"],
  ["PR", "Puerto Rico"],
  ["VI", "U.S. Virgin Islands"],
  ["AA", "Armed Forces Americas"],
  ["AE", "Armed Forces Europe"],
  ["AP", "Armed Forces Pacific"],
].map(([code, name]) => ({ code: code!, name: name! }));

const CA_PROVINCES: Option[] = [
  ["AB", "Alberta"],
  ["BC", "British Columbia"],
  ["MB", "Manitoba"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["NS", "Nova Scotia"],
  ["NT", "Northwest Territories"],
  ["NU", "Nunavut"],
  ["ON", "Ontario"],
  ["PE", "Prince Edward Island"],
  ["QC", "Quebec"],
  ["SK", "Saskatchewan"],
  ["YT", "Yukon"],
].map(([code, name]) => ({ code: code!, name: name! }));

/** The states or provinces a country's stores always ask for, as a list. Undefined for a free-text field. */
export function regionsOf(country: string): { label: string; options: Option[] } | undefined {
  if (country === "US") return { label: "State", options: US_STATES };
  if (country === "CA") return { label: "Province", options: CA_PROVINCES };
  return undefined;
}

/**
 * Calling codes by country, as the country and its digits: "US1", "GB44".
 * The Caribbean countries on +1 carry their area code too (Antigua is
 * 1268), so a number written with it finds its country. From the ITU list;
 * places with no phones of their own (Antarctica, Bouvet Island) are left out.
 */
const CALLING_CODES: Record<string, string> = Object.fromEntries(
  (
    "AD376 AE971 AF93 AG1268 AI1264 AL355 AM374 AO244 AR54 AS1684 AT43 AU61 AW297 AX358 AZ994 " +
    "BA387 BB1246 BD880 BE32 BF226 BG359 BH973 BI257 BJ229 BL590 BM1441 BN673 BO591 BQ599 BR55 " +
    "BS1242 BT975 BW267 BY375 BZ501 CA1 CC61 CD243 CF236 CG242 CH41 CI225 CK682 CL56 CM237 CN86 " +
    "CO57 CR506 CU53 CV238 CW599 CX61 CY357 CZ420 DE49 DJ253 DK45 DM1767 DO1 DZ213 EC593 EE372 " +
    "EG20 EH212 ER291 ES34 ET251 FI358 FJ679 FK500 FM691 FO298 FR33 GA241 GB44 GD1473 GE995 GF594 " +
    "GG44 GH233 GI350 GL299 GM220 GN224 GP590 GQ240 GR30 GT502 GU1671 GW245 GY592 HK852 HN504 " +
    "HR385 HT509 HU36 ID62 IE353 IL972 IM44 IN91 IO246 IQ964 IR98 IS354 IT39 JE44 JM1876 JO962 " +
    "JP81 KE254 KG996 KH855 KI686 KM269 KN1869 KP850 KR82 KW965 KY1 KZ7 LA856 LB961 LC1758 LI423 " +
    "LK94 LR231 LS266 LT370 LU352 LV371 LY218 MA212 MC377 MD373 ME382 MF590 MG261 MH692 MK389 " +
    "ML223 MM95 MN976 MO853 MP1670 MQ596 MR222 MS1664 MT356 MU230 MV960 MW265 MX52 MY60 MZ258 " +
    "NA264 NC687 NE227 NF672 NG234 NI505 NL31 NO47 NP977 NR674 NU683 NZ64 OM968 PA507 PE51 PF689 " +
    "PG675 PH63 PK92 PL48 PM508 PN64 PR1 PS970 PT351 PW680 PY595 QA974 RE262 RO40 RS381 RU7 RW250 " +
    "SA966 SB677 SC248 SD249 SE46 SG65 SH290 SI386 SJ47 SK421 SL232 SM378 SN221 SO252 SR597 SS211 " +
    "ST239 SV503 SX1721 SY963 SZ268 TC1649 TD235 TG228 TH66 TJ992 TK690 TL670 TM993 TN216 TO676 " +
    "TR90 TT1868 TV688 TW886 TZ255 UA380 UG256 US1 UY598 UZ998 VA39 VC1784 VE58 VG1284 VI1340 VN84 " +
    "VU678 WF681 WS685 XK383 YE967 YT262 ZA27 ZM260 ZW263 "
  )
    .trim()
    .split(" ")
    .map((t) => [t.slice(0, 2), t.slice(2)]),
);

/** The country a code means on its own, where several share it: +1 is the US, +44 the UK. */
const HOME_OF_CODE: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
  "44": "GB",
  "47": "NO",
  "61": "AU",
  "64": "NZ",
  "212": "MA",
  "262": "RE",
  "290": "SH",
  "358": "FI",
  "500": "FK",
  "590": "GP",
  "599": "CW",
  "672": "NF",
};

/** Every country with a calling code, A to Z, for the phone's country list. */
export const PHONE_COUNTRIES: Option[] = COUNTRIES.filter((c) => CALLING_CODES[c.code]);

/** A country's calling code, digits only: "1", "44", "1268". */
export function callingCodeOf(country: string): string | undefined {
  return CALLING_CODES[country.toUpperCase()];
}

/** A calling code as people write it: "+44", and "+1 268" for a Caribbean one. */
export function formatCallingCode(code: string): string {
  return code.length === 4 && code.startsWith("1") ? `+1 ${code.slice(1)}` : `+${code}`;
}

/** The flag emoji of a two-letter country code: "US" is 🇺🇸. */
export function flagOf(country: string): string {
  return String.fromCodePoint(
    ...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * The country the phone field starts with: the region of the browser's
 * language ("en-GB" is GB) when it has a calling code, else the US.
 */
export function guessPhoneCountry(): string {
  if (typeof navigator !== "undefined") {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const region = tag.split("-")[1]?.toUpperCase();
      if (region && CALLING_CODES[region]) return region;
    }
  }
  return "US";
}

/**
 * A number with its country code in it, as that country and the rest:
 * "+44 20 7946 0958" is GB and "20 7946 0958". Undefined when the number
 * is one of the picked country's own, or has no country code.
 *
 * With + or 00, a whole valid number takes its own country, as the phone
 * rules (libphonenumber) know it: +1 416 is Canada. A number still being
 * typed takes the country its code is home to, or the one picked when that
 * one has the code.
 *
 * Without either, the number is read with a country code only when it
 * cannot be one of the picked country's own, not even by its length, and
 * is a valid number with it: 34648766323 with the US picked is Spain. A
 * national number that happens to start like a code, such as a Brazilian
 * one in area 55, stays as it is.
 */
export function splitPhone(
  value: string,
  current: string,
): { country: string; national: string } | undefined {
  // Browsers can fill a number with marks around it that nobody sees (the
  // direction marks of a phone number shown left to right) or a full-width
  // plus. Neither is part of the number.
  const trimmed = value
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/^＋/, "+")
    .trim();
  const international = trimmed.startsWith("+")
    ? trimmed.slice(1)
    : trimmed.startsWith("00")
      ? trimmed.slice(2)
      : undefined;
  if (international === undefined) return withoutPlus(trimmed, current);
  const whole = fromRules(`+${international.replace(/\D/g, "")}`, international);
  if (whole) return whole;
  const digits = international.replace(/\D/g, "");
  // The longest code first: 1268 is Antigua before 1 is the US.
  for (let length = Math.min(4, digits.length); length >= 1; length--) {
    const code = digits.slice(0, length);
    const matches = PHONE_COUNTRIES.filter((c) => CALLING_CODES[c.code] === code).map(
      (c) => c.code,
    );
    if (!matches.length) continue;
    const country = matches.includes(current) ? current : (HOME_OF_CODE[code] ?? matches[0]!);
    return { country, national: afterDigits(international, length) };
  }
  return undefined;
}

/** A number with no + or 00: the picked country's own, or one with its code left in. */
function withoutPlus(
  text: string,
  current: string,
): { country: string; national: string } | undefined {
  const digits = text.replace(/\D/g, "");
  // A trunk 0 is always national. Under 11 digits it is a national number,
  // or one still being typed: part of a US number can look like a whole one
  // from elsewhere ("681 722…" is West Virginia, and also Wallis and Futuna).
  if (digits.startsWith("0") || digits.length < 11) return undefined;
  const own = parsePhoneNumberFromString(digits, current.toUpperCase() as CountryCode);
  if (own?.isPossible()) return undefined;
  return fromRules(`+${digits}`, text);
}

/**
 * A whole, valid number read by the phone rules, as its country and the
 * rest as it was written. Undefined when the rules do not know it, or its
 * country has no code here.
 */
function fromRules(
  e164: string,
  written: string,
): { country: string; national: string } | undefined {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed?.isValid() || !parsed.country) return undefined;
  const code = CALLING_CODES[parsed.country];
  // Our code for a Caribbean country carries its area code, 1268 for Antigua.
  if (!code || !parsed.number.slice(1).startsWith(code)) return undefined;
  return { country: parsed.country, national: afterDigits(written, code.length) };
}

/** What follows the first `count` digits, as it was written, without the spaces or dashes before it. */
function afterDigits(text: string, count: number): string {
  let seen = 0;
  let i = 0;
  while (i < text.length && seen < count) {
    if (/\d/.test(text[i]!)) seen++;
    i++;
  }
  // A parenthesis stays: in "+1 (415)" it opens the area code.
  return text.slice(i).replace(/^[\s).-]+/, "");
}

/** Plain lowercase letters, for matching what people type: "Åland" is "aland". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Names people type that are not the country's own: "uk" for the United Kingdom. */
const ALIASES: Record<string, string> = { uk: "GB", usa: "US", uae: "AE" };

const PHONE_INDEX = PHONE_COUNTRIES.map((country) => {
  const name = fold(country.name);
  return { country, name, words: name.split(/[\s&().,-]+/).filter(Boolean) };
});

/**
 * The phone's countries that match what the user typed, best first. Digits,
 * with or without +, match the calling code, the country it is home to
 * first. Letters match the two-letter code or a common name ("uk"), then a
 * name that starts with them, a word of the name ("korea"), and last
 * anywhere in the name. Accents do not count. Nothing typed is every country.
 */
export function searchPhoneCountries(query: string): Option[] {
  const q = fold(query.trim());
  if (!q) return PHONE_COUNTRIES;
  const digits = q.replace(/^\+/, "").replace(/\s+/g, "");
  if (/^\d+$/.test(digits)) {
    const rank = (code: string) => {
      const dial = CALLING_CODES[code]!;
      if (dial === digits) return HOME_OF_CODE[digits] === code ? 0 : 1;
      return dial.startsWith(digits) ? 2 : -1;
    };
    return byRank(PHONE_INDEX.map((e) => [e.country, rank(e.country.code)]));
  }
  const rank = (e: (typeof PHONE_INDEX)[number]) => {
    if (e.country.code.toLowerCase() === q || ALIASES[q] === e.country.code) return 0;
    if (e.name.startsWith(q)) return 1;
    if (e.words.some((w) => w.startsWith(q))) return 2;
    return e.name.includes(q) ? 3 : -1;
  };
  return byRank(PHONE_INDEX.map((e) => [e.country, rank(e)]));
}

/** The ranked ones, best first, A to Z within a rank; -1 is no match. */
function byRank(ranked: Array<[Option, number]>): Option[] {
  return ranked
    .filter(([, r]) => r >= 0)
    .sort((a, b) => a[1] - b[1])
    .map(([c]) => c);
}
