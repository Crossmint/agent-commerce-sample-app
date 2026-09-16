import type { CSSProperties, ReactNode } from "react";

/** Which real chat app a screen imitates. */
export type ChatStyle = "imessage" | "instagram" | "grok";

/**
 * One message in a thread. The same list renders in each chat style; the
 * style decides bubbles, tails, grouping, and how a link preview looks.
 */
export interface ChatMessage {
  key: string;
  from: "user" | "agent" | "status";
  /** ms after the thread mounts. */
  at: number;
  /** Text or rich content inside a normal bubble. */
  node?: ReactNode;
  /** A link the agent sent. Styles render it as a rich preview card. */
  link?: ChatLink;
  /** Content that fills the bubble edge to edge (progress cards, lists). */
  card?: ReactNode;
}

export interface ChatLink {
  domain: string;
  title: string;
  path?: string;
}

export interface ChatScreenProps {
  /** Contact name in the header. */
  name: string;
  /** Logo for the contact avatar. Default: a neutral robot mark. */
  logo?: string;
  /** How the logo sits in the avatar. Default "mark". */
  logoStyle?: "fill" | "mark";
  messages: ChatMessage[];
}

/**
 * Screen color behind the status bar for each chat style. iMessage is the
 * dark appearance; Instagram Direct and Grok are their light themes.
 */
export const CHAT_SCREEN_BG: Record<ChatStyle, string> = {
  imessage: "bg-black",
  instagram: "bg-white",
  grok: "bg-[#f9f8f7]",
};

/** Status bar glyph tone for each chat style. */
export const CHAT_TONE: Record<ChatStyle, "light" | "dark"> = {
  imessage: "light",
  instagram: "dark",
  grok: "dark",
};

/** Human name of each app, for accessible labels. */
export const CHAT_APP_NAME: Record<ChatStyle, string> = {
  imessage: "iMessage",
  instagram: "Instagram",
  grok: "Grok",
};

export const delayStyle = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/** True when this is the last message of a run from the same sender. */
export function endsGroup(messages: ChatMessage[], i: number): boolean {
  const cur = messages[i];
  const next = messages[i + 1];
  return !cur || !next || next.from !== cur.from;
}

/** True when this is the last message the user sent. */
export function isLastFromUser(messages: ChatMessage[], i: number): boolean {
  return messages[i]?.from === "user" && !messages.slice(i + 1).some((m) => m.from === "user");
}
