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
 * the position: pass the message count, so sending always shows the new turn.
 */
export function useScrollToBottom(trigger?: unknown) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const pinned = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    pinned.current = true;
    setIsAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Where the reader is. Only their own input can unpin.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let intent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onIntent = () => {
      intent = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (intent = false), 250);
    };
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - NEAR;
      setIsAtBottom(atBottom);
      if (atBottom) pinned.current = true;
      else if (intent) pinned.current = false;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onIntent, { passive: true });
    el.addEventListener("touchmove", onIntent, { passive: true });
    el.addEventListener("keydown", onIntent);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onIntent);
      el.removeEventListener("touchmove", onIntent);
      el.removeEventListener("keydown", onIntent);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Follow the end while pinned: new nodes, new text, and anything that grows.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Straight away, not on the next frame: a browser that holds frames back
    // (a background tab, a pane not painting) would otherwise leave it behind.
    const follow = () => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    };
    const mo = new MutationObserver(follow);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(follow);
    ro.observe(el);
    const watchContent = () => {
      for (const child of Array.from(el.children)) ro.observe(child);
    };
    watchContent();
    const childMo = new MutationObserver(watchContent);
    childMo.observe(el, { childList: true });
    // Pictures load after they mount; each one moves the end.
    el.addEventListener("load", follow, true);
    // Content already there on mount, such as a saved chat, starts at the end too.
    follow();
    return () => {
      mo.disconnect();
      childMo.disconnect();
      ro.disconnect();
      el.removeEventListener("load", follow, true);
    };
  }, []);

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
