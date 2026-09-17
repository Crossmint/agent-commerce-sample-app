import type { PresentationConfig } from "@stytch/nextjs";

/** Crossmint Agents look for Stytch's prebuilt UI: navy text, green primary, 8px corners. */
export const stytchPresentation: PresentationConfig = {
  theme: {
    "color-scheme": "light",
    "font-family": "inherit",
    "container-width": "100%",
    "container-border": "transparent",
    "rounded-base": "8px",
    "button-radius": "8px",
    "input-radius": "8px",
    background: "transparent",
    foreground: "#0a1825",
    primary: "#11ba4b",
    "primary-foreground": "#ffffff",
    "primary-button-hover": "#0fa843",
    "muted-foreground": "#5b6670",
    border: "rgba(10, 24, 37, 0.12)",
    input: "rgba(10, 24, 37, 0.12)",
    ring: "#11ba4b",
    success: "#11ba4b",
  },
};
