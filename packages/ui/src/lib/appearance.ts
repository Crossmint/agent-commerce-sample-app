/*
 * The Agent Commerce theme, read off the CSS variables so Crossmint's iframes
 * match the page.
 *
 * Every color goes out as sRGB hex. The theme is authored in oklch, which the
 * browser hands back as `lab(...)`, and Crossmint's appearance parser throws
 * on it: "Unable to parse color from string: lab(...)". That throw happens
 * inside their iframe, which then never reports its height, so the card form
 * is a silent 0px box on the page and nothing on ours catches it. Hex is the
 * one format everything reads.
 */

const SENTINEL = "#010203";
let paintCtx: CanvasRenderingContext2D | null | undefined;

/** One 1x1 canvas, kept: the conversion runs once per color per theme read. */
function context(): CanvasRenderingContext2D | null {
  if (paintCtx !== undefined) return paintCtx;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  paintCtx = canvas.getContext("2d", { willReadFrequently: true });
  return paintCtx;
}

/**
 * Any CSS color to sRGB hex, via the pixel a canvas paints it as. Reading
 * `fillStyle` back cannot do this on its own: it echoes `lab()` and
 * `oklch()` straight through. Undefined when the string is not a color, so
 * the caller can fall back rather than ship black.
 */
export function toSrgb(value: string): string | undefined {
  const ctx = context();
  if (!ctx || !value) return undefined;
  ctx.fillStyle = SENTINEL;
  ctx.fillStyle = value;
  // An unparsable value leaves the previous one in place.
  if (ctx.fillStyle === SENTINEL && value.replace(/\s/g, "").toLowerCase() !== SENTINEL) {
    return undefined;
  }
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data as unknown as [
    number,
    number,
    number,
    number,
  ];
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return a === 255
    ? `#${hex(r)}${hex(g)}${hex(b)}`
    : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

export interface ThemeColors {
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  border: string;
  destructive: string;
  success: string;
  radius: string;
  fontFamily: string;
}

/** The theme's colors in hex, its radius and its font. Undefined during SSR. */
export function readThemeColors(el?: Element | null): ThemeColors | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") return undefined;
  const target = el ?? document.documentElement;
  const cs = getComputedStyle(target);
  /** A color token, in hex whatever the stylesheet wrote it in. */
  const c = (name: string, fallback: string) =>
    toSrgb(cs.getPropertyValue(name).trim()) ?? fallback;
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    background: c("--background", "#ffffff"),
    card: c("--card", "#ffffff"),
    foreground: c("--foreground", "#171717"),
    mutedForeground: c("--muted-foreground", "#737373"),
    primary: c("--primary", "#4564ff"),
    primaryForeground: c("--primary-foreground", "#ffffff"),
    border: c("--border", "#e5e7eb"),
    destructive: c("--destructive", "#dc2626"),
    success: c("--success", "#16a34a"),
    radius: v("--radius", "0.625rem"),
    fontFamily: cs.fontFamily || "system-ui, sans-serif",
  };
}

/**
 * The primary button, in the theme's own color.
 *
 * `variables.colors.accent` does not reach it — it colors the selection
 * controls, and the button keeps Crossmint's default green. Only the
 * `PrimaryButton` rule moves it.
 */
function primaryButtonRule(t: ThemeColors) {
  return {
    colors: { background: t.primary, text: t.primaryForeground },
    hover: { colors: { background: shade(t.primary, "#000000", 88) } },
    disabled: {
      colors: { background: shade(t.primary, "#ffffff", 40), text: t.primaryForeground },
    },
  };
}

/** `amount`% of `color`, the rest `towards`. Falls back to the color itself. */
function shade(color: string, towards: string, amount: number): string {
  return toSrgb(`color-mix(in srgb, ${color} ${amount}%, ${towards})`) ?? color;
}

/** Appearance for `CrossmintPaymentMethodManagement`, built from the current theme. */
export function paymentMethodAppearanceFromTheme(el?: Element | null) {
  const t = readThemeColors(el);
  if (!t) return undefined;
  return {
    variables: {
      fontFamily: t.fontFamily,
      borderRadius: t.radius,
      colors: {
        borderPrimary: t.border,
        backgroundPrimary: t.card,
        textPrimary: t.foreground,
        textSecondary: t.mutedForeground,
        danger: t.destructive,
        accent: t.primary,
      },
    },
    rules: { PrimaryButton: primaryButtonRule(t) },
  };
}

/** Appearance for `OrderIntentVerification`, built from the current theme. */
export function verificationAppearanceFromTheme(el?: Element | null) {
  const t = readThemeColors(el);
  if (!t) return undefined;
  return {
    variables: {
      fontFamily: t.fontFamily,
      borderRadius: t.radius,
      colors: {
        accent: t.primary,
        textPrimary: t.foreground,
        textSecondary: t.mutedForeground,
        backgroundPrimary: t.card,
        backgroundSecondary: t.background,
        border: t.border,
        danger: t.destructive,
        success: t.success,
      },
    },
    rules: { PrimaryButton: primaryButtonRule(t) },
  };
}
