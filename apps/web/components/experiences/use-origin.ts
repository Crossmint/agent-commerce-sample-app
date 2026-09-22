"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * window.location.origin on the client, null during server rendering. The
 * origin is part of the copy on the MCP and CLI panels, and the server does
 * not know which host the visitor came through.
 */
export function useOrigin(): string | null {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => null,
  );
}
