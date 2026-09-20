"use client";

import * as React from "react";

/**
 * True while `query` matches. False during server rendering and on the first
 * client render, so a component that branches on it must render the same
 * thing on both — open a dialog on it, not a layout.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Narrower than Tailwind's `sm` breakpoint: a phone, where sheets beat modals. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639.98px)");
}
