import type { ChatStyle } from "./chat/model";

/** The three agent brands in the "Make it feel like your brand" demo. */
export type BrandId = "instinct" | "muse" | "grokbot";

/** Which approval screen layout a brand uses. "goat" is the generic template screen. */
export type ApprovalLayout = BrandId | "goat";

export interface Brand {
  id: BrandId | "goat";
  name: string;
  /** Logo under `public/`. A monochrome white mark on transparent. */
  logo: string;
  /** Host shown in the browser bar and in the approval link. */
  domain: string;
  /** Which chat app the demo thread imitates. */
  chatStyle: ChatStyle;
  /** Light brands get dark status bar glyphs and a light browser chrome. */
  tone: "light" | "dark";
  approval: ApprovalLayout;
}

/** The unbranded template screen, used by the hero and the core pieces. */
export const DEFAULT_BRAND: Brand = {
  id: "goat",
  name: "Your agent",
  logo: "/brand/mark.png",
  domain: "yourplatform.com",
  chatStyle: "imessage",
  tone: "dark",
  approval: "goat",
};

/** A brand in the switcher: never the generic template screen. */
export interface AgentBrand extends Brand {
  id: BrandId;
}

export const BRANDS: AgentBrand[] = [
  { id: "instinct", name: "Instinct", logo: "/logos/instinct.svg", domain: "instinct.app", chatStyle: "imessage", tone: "light", approval: "instinct" },
  { id: "muse", name: "Muse", logo: "/logos/muse.svg", domain: "muse.ai", chatStyle: "instagram", tone: "dark", approval: "muse" },
  { id: "grokbot", name: "GrokBot", logo: "/logos/grok.svg", domain: "grok.com", chatStyle: "grok", tone: "dark", approval: "grokbot" },
];
