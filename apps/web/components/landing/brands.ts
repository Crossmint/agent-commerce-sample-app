import type { CSSProperties } from "react";
import type { ThreadStyle } from "./message-thread-mock";

export type BrandId = "goat" | "nimbus" | "forge";

export interface Brand {
  id: BrandId;
  name: string;
  blurb: string;
  /** Host shown in the browser bar and in the approval link. */
  domain: string;
  /** Light brands get dark status bar glyphs and a light browser chrome. */
  tone: "light" | "dark";
  /** Which chat skin the demo thread uses next to the approval screen. */
  threadStyle: ThreadStyle;
  /** Theme tokens for the wrapper. The same names `@goat-wallet/ui` reads. */
  vars: CSSProperties;
}

const goat: CSSProperties = {
  "--background": "#14140f",
  "--foreground": "#f3efe6",
  "--card": "#1c1c15",
  "--card-foreground": "#f3efe6",
  "--primary": "#e8632b",
  "--primary-foreground": "#fff8f2",
  "--secondary": "#26261e",
  "--secondary-foreground": "#f3efe6",
  "--muted": "#23231b",
  "--muted-foreground": "#a39e90",
  "--accent": "#2b2b22",
  "--accent-foreground": "#f3efe6",
  "--border": "#2f2f26",
  "--input": "#34342a",
  "--ring": "#e8632b",
  "--radius": "1rem",
  "--radius-button": "9999px",
  "--font-heading": "inherit",
  fontFamily: "var(--font-sans)",
} as CSSProperties;

const nimbus: CSSProperties = {
  "--background": "#f5f6ff",
  "--foreground": "#1e1b4b",
  "--card": "#ffffff",
  "--card-foreground": "#1e1b4b",
  "--primary": "#4f46e5",
  "--primary-foreground": "#ffffff",
  "--secondary": "#e9eafc",
  "--secondary-foreground": "#1e1b4b",
  "--muted": "#eceefb",
  "--muted-foreground": "#5a5d86",
  "--accent": "#e4e6fb",
  "--accent-foreground": "#1e1b4b",
  "--border": "#dcdff4",
  "--input": "#d5d8f0",
  "--ring": "#4f46e5",
  "--radius": "1.5rem",
  "--radius-button": "9999px",
  "--font-heading": "inherit",
  fontFamily: "ui-rounded, 'SF Pro Rounded', var(--font-sans)",
} as CSSProperties;

const forge: CSSProperties = {
  "--background": "#0a0a0a",
  "--foreground": "#f4f4f2",
  "--card": "#121212",
  "--card-foreground": "#f4f4f2",
  "--primary": "#a3e635",
  "--primary-foreground": "#0a0a0a",
  "--secondary": "#1c1c1c",
  "--secondary-foreground": "#f4f4f2",
  "--muted": "#1a1a1a",
  "--muted-foreground": "#9a9a94",
  "--accent": "#202020",
  "--accent-foreground": "#f4f4f2",
  "--border": "#2a2a2a",
  "--input": "#2e2e2e",
  "--ring": "#a3e635",
  "--radius": "6px",
  "--radius-button": "6px",
  "--font-heading": "var(--font-mono)",
  fontFamily: "var(--font-mono)",
} as CSSProperties;

export const DEFAULT_BRAND: Brand = {
  id: "goat",
  name: "GOAT",
  blurb: "Dark warm ground, one orange accent, a centered card.",
  domain: "goat.wallet",
  tone: "dark",
  threadStyle: "imessage",
  vars: goat,
};

export const BRANDS: Brand[] = [
  DEFAULT_BRAND,
  {
    id: "nimbus",
    name: "Nimbus",
    blurb: "A travel assistant. Light, indigo, a full-height sheet with a big amount.",
    domain: "nimbus.travel",
    tone: "light",
    threadStyle: "whatsapp",
    vars: nimbus,
  },
  {
    id: "forge",
    name: "Forge",
    blurb: "A dev tools brand. Near-black, lime, a monospace receipt.",
    domain: "forge.tools",
    tone: "dark",
    threadStyle: "imessage",
    vars: forge,
  },
];
