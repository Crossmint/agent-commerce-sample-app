"use client";

import { useEffect, useRef, useState } from "react";

export interface UseInViewOptions {
  /** Stop observing after the first time the element is in view. */
  once?: boolean;
  threshold?: number | number[];
  rootMargin?: string;
}

/**
 * Tracks whether an element is in the viewport.
 * `inView` is null until the observer reports for the first time, so callers
 * can tell "not measured yet" from "off screen" and avoid hiding content that
 * is already visible.
 */
export function useInView<T extends Element>({ once = false, threshold = 0.25, rootMargin }: UseInViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState<boolean | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;
        setInView(visible);
        if (visible && once) io.disconnect();
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold, rootMargin]);

  return { ref, inView };
}
