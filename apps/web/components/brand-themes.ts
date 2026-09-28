/*
 * The three example brands the sample app can wear. A brand is a set of
 * theme tokens (colors, radius, type) applied through `data-brand` on a
 * wrapper element; every component below it follows, because the UI kit
 * only ever reads tokens. The values live in `app/globals.css`.
 *
 * "acme" is the default and the tokens in `packages/ui/src/styles.css`.
 * "nova" is dark with a lime accent and full-round corners. "maple" is warm
 * and editorial, with a serif display face and square corners.
 */

export const BRAND_THEMES = ["acme", "nova", "maple"] as const;
export type BrandTheme = (typeof BRAND_THEMES)[number];

export interface BrandThemeMeta {
  id: BrandTheme;
  name: string;
  /** One line that says what the look is. */
  tagline: string;
  /** Swatch colors for a picker, in the same order everywhere: ground, text, accent. */
  swatch: [string, string, string];
}

export const BRAND_THEME_META: Record<BrandTheme, BrandThemeMeta> = {
  acme: { id: "acme", name: "Acme", tagline: "Clean and blue, the default.", swatch: ["#ffffff", "#171717", "#4564ff"] },
  nova: { id: "nova", name: "Nova", tagline: "Dark, lime accent, round everything.", swatch: ["#0b0b10", "#f4f4f8", "#c8f560"] },
  maple: { id: "maple", name: "Maple", tagline: "Warm paper, serif headings, square corners.", swatch: ["#fbf7f0", "#2b1d14", "#d2521b"] },
};

export const DEFAULT_BRAND_THEME: BrandTheme = "acme";

export function isBrandTheme(v: string | null | undefined): v is BrandTheme {
  return BRAND_THEMES.includes(v as BrandTheme);
}
