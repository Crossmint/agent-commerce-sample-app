import type { CSSProperties, ReactNode } from "react";

/**
 * One message in a mock thread. Bubbles land on CSS delays from the moment
 * the thread mounts, so a parent remounts the thread (a key) to replay it.
 * iMessage, WhatsApp and Instagram all render this one model.
 */
export interface ChatMessage {
  key: string;
  from: "user" | "agent" | "status";
  /** ms after the thread mounts. */
  at: number;
  /** Text or rich content inside a normal bubble. */
  node?: ReactNode;
  /** A link the agent sent. Each app renders it as its own preview card. */
  link?: ChatLink;
  /** Content that fills the bubble edge to edge (progress cards, lists). */
  card?: ReactNode;
  /**
   * The card draws its own surface (a receipt). Styles render it with no
   * bubble or tail, and it closes the group before it.
   */
  bare?: boolean;
}

export interface ChatLink {
  /** The host, as the preview shows it. */
  domain: string;
  title: string;
  /** One line under the title. */
  description?: string;
  /** The full URL, for apps that print it under the preview. */
  url?: string;
}

export const delayStyle = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/** True when this is the first message of a run from the same sender. A bare card is its own group. */
export function startsGroup(messages: ChatMessage[], i: number): boolean {
  const cur = messages[i];
  const prev = messages[i - 1];
  return !cur || !prev || prev.from !== cur.from || Boolean(cur.bare) || Boolean(prev.bare);
}

/** True when this is the last message of a run from the same sender. A bare card is its own group. */
export function endsGroup(messages: ChatMessage[], i: number): boolean {
  const cur = messages[i];
  const next = messages[i + 1];
  return !cur || !next || next.from !== cur.from || Boolean(cur.bare) || Boolean(next.bare);
}

/** True when this is the last message the user sent. */
export function isLastFromUser(messages: ChatMessage[], i: number): boolean {
  return messages[i]?.from === "user" && !messages.slice(i + 1).some((m) => m.from === "user");
}
