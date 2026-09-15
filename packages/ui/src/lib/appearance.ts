/**
 * Read the GOAT theme from CSS variables so Crossmint's iframes match the page.
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
    background: v("--background", "#14140f"),
    card: v("--card", "#1c1c15"),
    foreground: v("--foreground", "#f3efe6"),
    mutedForeground: v("--muted-foreground", "#a39e90"),
    primary: v("--primary", "#e8632b"),
    border: v("--border", "#2f2f26"),
    destructive: v("--destructive", "#e05a48"),
    success: v("--success", "#57b37f"),
    radius: v("--radius", "1rem"),
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
