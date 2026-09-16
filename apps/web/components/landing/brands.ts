import type { ChatStyle } from "./chat/model";

/** The three agent brands in the "Make it feel like your brand" demo. */
export type BrandId = "instinct" | "muse" | "grokbot";

/** Which approval screen layout a brand uses. "goat" is the generic template screen. */
export type ApprovalLayout = BrandId | "goat";

export interface Brand {
  id: BrandId | "goat";
  name: string;
  /** Logo under `public/`. */
  logo: string;
  /**
   * How the logo sits in a round avatar. "fill": the file is a full app icon
   * and covers the circle. "mark": a glyph on transparent, centered on a
   * neutral disc.
   */
  logoStyle: "fill" | "mark";
  /** Host shown in the browser bar and in the approval link. */
  domain: string;
  /** Which chat app the demo thread imitates. */
  chatStyle: ChatStyle;
  /** Tone of the approval pages. Light brands get dark status bar glyphs and a light browser chrome. */
  tone: "light" | "dark";
  approval: ApprovalLayout;
}

/** The unbranded template screen, used by the hero and the core pieces. */
export const DEFAULT_BRAND: Brand = {
  id: "goat",
  name: "Your agent",
  logo: "/brand/mark.png",
  logoStyle: "mark",
  domain: "yourplatform.com",
  chatStyle: "imessage",
  tone: "dark",
  approval: "goat",
};

/** A brand in the switcher: never the generic template screen. */
export interface AgentBrand extends Brand {
  id: BrandId;
}

/*
 * Real products, real marks. Sources are in public/logos/SOURCES.md.
 * - Instinct lives in iMessage and WhatsApp, so its thread is iMessage.
 * - Muse is Meta's agent; the thread is Instagram Direct. Its avatar is the
 *   Muse app icon (the blue squiggle on a white tile).
 * - Grok Bot (x.ai/bot) is messaged in its own app. Its avatar is the Grok
 *   Bot mark: the black blob with two eyes from the product page.
 */
export const BRANDS: AgentBrand[] = [
  { id: "instinct", name: "Instinct", logo: "/logos/instinct.svg", logoStyle: "fill", domain: "instinct.co", chatStyle: "imessage", tone: "light", approval: "instinct" },
  { id: "muse", name: "Muse", logo: "/logos/muse.svg", logoStyle: "fill", domain: "muse.ai", chatStyle: "instagram", tone: "light", approval: "muse" },
  { id: "grokbot", name: "Grok Bot", logo: "/logos/grok-bot-mark.svg", logoStyle: "fill", domain: "x.ai", chatStyle: "grok", tone: "light", approval: "grokbot" },
];
