"use client";

import { useEffect, useRef } from "react";

/**
 * Attributes for each message wrapper in a thread, so `useFollowLatest`
 * can find it and knows when it lands.
 */
export const messageAttrs = (at: number) => ({ "data-message": "", "data-at": at }) as const;

/**
 * Keeps a thread scrolled to its newest message.
 *
 * Every bubble is in the layout from mount: CSS delays hide it until its
 * time. A thread taller than the screen would show the empty space of the
 * bubbles still to come and clip the ones that already landed. This hook
 * scrolls the list so each message's bottom edge is in view the moment it
 * lands, and only ever forward. Under reduced motion every bubble shows at
 * once, so it jumps to the end.
 *
 * The container needs `overflow-hidden` and `relative`; the list inside it
 * needs `mt-auto` so a short thread still rests at the bottom (flex
 * `justify-end` would put the overflow past the start edge, out of reach).
 * Runs once per mount: threads remount to replay.
 */
export function useFollowLatest<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const reveal = (el: HTMLElement, behavior: ScrollBehavior) => {
      const top = Math.min(el.offsetTop + el.offsetHeight + 4 - box.clientHeight, box.scrollHeight - box.clientHeight);
      if (top > box.scrollTop) box.scrollTo({ top, behavior });
    };
    const items = Array.from(box.querySelectorAll<HTMLElement>("[data-message]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      box.scrollTop = box.scrollHeight;
      return;
    }
    const ids = items.map((el) => window.setTimeout(() => reveal(el, "smooth"), Number(el.dataset.at ?? 0)));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);
  return ref;
}
