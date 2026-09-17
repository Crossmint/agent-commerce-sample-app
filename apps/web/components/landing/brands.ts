import type { ChatStyle } from "./chat/model";

/** The three agent brands in the "Make it feel like your brand" demo. */
export type BrandId = "impulse" | "lumen" | "botbot";

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
  logo: "/brand/agents/crossmint-agents-mark.svg",
  logoStyle: "mark",
  domain: "yourplatform.com",
  chatStyle: "imessage",
  tone: "light",
  approval: "goat",
};

/** A brand in the switcher: never the generic template screen. */
export interface AgentBrand extends Brand {
  id: BrandId;
}

/*
 * Three example agents. Not real companies: the names, domains, and marks
 * are original GOAT art (see public/logos/SOURCES.md).
 * - Impulse lives in iMessage. Its mark is a dark rounded tile with a
 *   white bolt.
 * - Lumen has a light, Meta-style UI; the thread is Instagram Direct. Its
 *   mark is a blue-to-violet circle with a white spark.
 * - BotBot is messaged in its own app. Its mark is a black rounded square
 *   with two round white eyes and a small antenna.
 */
export const BRANDS: AgentBrand[] = [
  { id: "impulse", name: "Impulse", logo: "/logos/impulse.svg", logoStyle: "fill", domain: "impulse.app", chatStyle: "imessage", tone: "light", approval: "impulse" },
  { id: "lumen", name: "Lumen", logo: "/logos/lumen.svg", logoStyle: "fill", domain: "lumen.ai", chatStyle: "instagram", tone: "light", approval: "lumen" },
  { id: "botbot", name: "BotBot", logo: "/logos/botbot.svg", logoStyle: "fill", domain: "botbot.dev", chatStyle: "grok", tone: "light", approval: "botbot" },
];
