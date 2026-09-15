"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps a scroll container pinned to the bottom while content streams in,
 * unless the user scrolled up. Adapted from the Vercel AI Chatbot template.
 */
export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const userScrollingRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      userScrollingRef.current = true;
      if (timer) clearTimeout(timer);
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;
      timer = setTimeout(() => {
        userScrollingRef.current = false;
      }, 150);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const follow = () => {
      if (!isAtBottomRef.current || userScrollingRef.current) return;
      requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "instant" }));
    };
    const mo = new MutationObserver(follow);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(follow);
    ro.observe(el);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  return { containerRef, isAtBottom, scrollToBottom };
}
