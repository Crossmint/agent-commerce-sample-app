"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chat/types";
import { productsMessageOf, receiptMessageOf } from "./parts";

/*
 * The small sounds a chat app makes: a soft two-note pop when the agent's
 * message lands, a short lower tone when the user sends one. Made with the
 * Web Audio API, so there are no audio files to ship. Quiet on purpose, and
 * only for messages that arrive while the chat is open: a saved conversation
 * loading makes no sound.
 */

let context: AudioContext | undefined;

function audio(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    context ??= new AudioContext();
    // Browsers start a context suspended until the page has had a user
    // gesture; by the time a reply lands the user has typed or tapped.
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return undefined;
  }
}

/** One short sine note with a quick fade, starting `delay` seconds from now. */
function note(ctx: AudioContext, frequency: number, delay: number, length: number, volume: number) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

export function playSound(kind: "receive" | "send"): void {
  const ctx = audio();
  if (!ctx) return;
  if (kind === "receive") {
    note(ctx, 880, 0, 0.12, 0.06);
    note(ctx, 1320, 0.07, 0.16, 0.05);
  } else {
    note(ctx, 620, 0, 0.1, 0.04);
  }
}

/** How many things in the thread count as a message: the user's turns, and each non-empty line the agent writes. */
function counts(messages: ChatMessage[]): { sent: number; received: number } {
  let sent = 0;
  let received = 0;
  for (const m of messages) {
    if (m.role === "user") sent++;
    else if (m.role === "assistant") {
      for (const p of m.parts) {
        if (p.type === "text" && p.text.trim()) received++;
        // A look-up carries its own line above the cards.
        else if (productsMessageOf(p)) received++;
        // So does a receipt.
        else if (receiptMessageOf(p)) received++;
      }
    }
  }
  return { sent, received };
}

/**
 * Plays the sounds as the thread grows during a turn. The first count is the
 * baseline, and a thread that grows while no turn runs (a saved chat's
 * history arriving) stays silent; switching chats resets it.
 */
export function useChatSounds(chatId: string, messages: ChatMessage[], live: boolean): void {
  const seen = useRef<{ chatId: string; sent: number; received: number } | null>(null);
  useEffect(() => {
    const now = counts(messages);
    const before = seen.current;
    seen.current = { chatId, ...now };
    if (!live || !before || before.chatId !== chatId) return;
    if (now.received > before.received) playSound("receive");
    else if (now.sent > before.sent) playSound("send");
  }, [chatId, messages, live]);
}
