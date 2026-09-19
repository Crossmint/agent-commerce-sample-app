"use client";

import * as React from "react";
import { CrossmintProvider } from "@crossmint/client-sdk-react-ui";
import { useGoat } from "../provider.js";

/**
 * Mounts Crossmint's React SDK around the one component that needs it (save
 * card, verification). The SDK is browser-only, so the provider mounts after
 * hydration; wrapping only these leaves keeps the rest of the page in place.
 * When `GoatProvider` wrapped the whole app instead, the tree changed shape
 * on the client, React recreated every node, and entrance animations ran
 * twice.
 *
 * A malformed client key must not take the component down with an exception:
 * the boundary falls back to `fallback` and warns once.
 */
export function CrossmintScope({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { crossmint, jwt } = useGoat();
  const isClient = useIsClient();
  if (!crossmint.clientApiKey || !isClient) return <>{fallback}</>;
  return (
    <CrossmintBoundary fallback={fallback}>
      <CrossmintProvider apiKey={crossmint.clientApiKey} jwt={jwt ?? undefined} consoleLogLevel="warn">
        {children}
      </CrossmintProvider>
    </CrossmintBoundary>
  );
}

class CrossmintBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn("[goat] Crossmint provider failed to mount. Save card and verification are disabled.", error);
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const subscribeNoop = () => () => {};
function useIsClient(): boolean {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}
