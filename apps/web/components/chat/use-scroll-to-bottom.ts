"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How close to the end still counts as "at the bottom", in pixels. */
const NEAR = 80;

/**
 * Keeps a scroll container pinned to the bottom while content comes in,
 * unless the user scrolled up to read. Adapted from the Vercel AI Chatbot
 * template.
 *
 * It follows the content's own height, not only the DOM: a picture that
 * finishes loading, or a card that grows, moves the end without adding a
 * node. Only the user's own input (wheel, touch, keys) counts as scrolling
 * away; the hook's own scrolls do not. `trigger` jumps to the bottom whatever
 * the position: pass `threadSize`, so every new message or card shows.
 *
 * `containerRef` is a callback ref. The scroll box often mounts after the
 * hook, when the first message replaces a greeting, and the watchers attach
 * to it then.
 */
export function useScrollToBottom(trigger?: unknown) {
  const node = useRef<HTMLDivElement | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((next: HTMLDivElement | null) => {
    node.current = next;
    setEl(next);
  }, []);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const pinned = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = node.current;
    if (!el) return;
    pinned.current = true;
    setIsAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Where the reader is. Only their own input can unpin. `el` says when the
  // box mounts; the box itself is read from the ref, which may be written to.
  useEffect(() => {
    const box = node.current;
    if (!el || !box) return;
    let intent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onIntent = () => {
      intent = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (intent = false), 250);
    };
    const onScroll = () => {
      const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - NEAR;
      setIsAtBottom(atBottom);
      if (atBottom) pinned.current = true;
      else if (intent) pinned.current = false;
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    box.addEventListener("wheel", onIntent, { passive: true });
    box.addEventListener("touchmove", onIntent, { passive: true });
    box.addEventListener("keydown", onIntent);
    return () => {
      box.removeEventListener("scroll", onScroll);
      box.removeEventListener("wheel", onIntent);
      box.removeEventListener("touchmove", onIntent);
      box.removeEventListener("keydown", onIntent);
      if (timer) clearTimeout(timer);
    };
  }, [el]);

  // Follow the end while pinned: new nodes, new text, and anything that grows.
  useEffect(() => {
    const box = node.current;
    if (!el || !box) return;
    // Straight away, not on the next frame: a browser that holds frames back
    // (a background tab, a pane not painting) would otherwise leave it behind.
    const follow = () => {
      if (pinned.current) box.scrollTop = box.scrollHeight;
    };
    const mo = new MutationObserver(follow);
    mo.observe(box, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(follow);
    ro.observe(box);
    const watchContent = () => {
      for (const child of Array.from(box.children)) ro.observe(child);
    };
    watchContent();
    const childMo = new MutationObserver(watchContent);
    childMo.observe(box, { childList: true });
    // Pictures load after they mount; each one moves the end.
    box.addEventListener("load", follow, true);
    // Content already there on mount, such as a saved chat, starts at the end too.
    follow();
    return () => {
      mo.disconnect();
      childMo.disconnect();
      ro.disconnect();
      box.removeEventListener("load", follow, true);
    };
  }, [el]);

  // A new turn always shows, even when the reader had scrolled up.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scrollToBottom("smooth");
  }, [trigger, scrollToBottom]);

  return { containerRef, isAtBottom, scrollToBottom };
}

/**
 * How much the thread holds, as one number that grows with every new
 * message and every new part of one: a card the agent adds after the user
 * answers lands in the same message, and still counts.
 */
export function threadSize(messages: ReadonlyArray<{ parts: readonly unknown[] }>): number {
  let size = messages.length;
  for (const m of messages) size += m.parts.length;
  return size;
}
