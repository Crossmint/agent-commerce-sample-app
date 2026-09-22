/**
 * Read the Agent Commerce theme from CSS variables so Crossmint's iframes match the page.
 * Runs in the browser only. Returns undefined during SSR.
 */
export interface ThemeColors {
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  border: string;
  destructive: string;
  success: string;
  radius: string;
  fontFamily: string;
}

export function readThemeColors(el?: Element | null): ThemeColors | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") return undefined;
  const target = el ?? document.documentElement;
  const cs = getComputedStyle(target);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    background: v("--background", "#ffffff"),
    card: v("--card", "#ffffff"),
    foreground: v("--foreground", "#171717"),
    mutedForeground: v("--muted-foreground", "#737373"),
    primary: v("--primary", "#4564ff"),
    border: v("--border", "#e5e7eb"),
    destructive: v("--destructive", "#dc2626"),
    success: v("--success", "#16a34a"),
    radius: v("--radius", "0.625rem"),
    fontFamily: cs.fontFamily || "system-ui, sans-serif",
  };
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
  };
}
