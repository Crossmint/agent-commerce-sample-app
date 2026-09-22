"use client";

import * as React from "react";
import { CrossmintProvider } from "@crossmint/client-sdk-react-ui";
import { useAgentCommerce } from "../provider.js";

/**
 * Mounts Crossmint's React SDK around the one component that needs it (save
 * card, verification). The SDK is browser-only, so the provider mounts after
 * hydration; wrapping only these leaves keeps the rest of the page in place.
 * When `AgentCommerceProvider` wrapped the whole app instead, the tree changed shape
 * on the client, React recreated every node, and entrance animations ran
 * twice.
 *
 * A malformed client key must not take the component down with an exception:
 * the boundary falls back to `fallback` and warns once.
 */
export function CrossmintScope({
  children,
  fallback = null,
  failedFallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /**
   * Shown when the provider throws, where `fallback` is also the wait before
   * hydration. Without it a fault and a wait look the same, and a skeleton
   * that never resolves says nothing.
   */
  failedFallback?: React.ReactNode;
}) {
  const { crossmint, jwt } = useAgentCommerce();
  const isClient = useIsClient();
  if (!crossmint.clientApiKey || !isClient) return <>{fallback}</>;
  return (
    <CrossmintBoundary fallback={failedFallback ?? fallback}>
      <CrossmintProvider
        apiKey={crossmint.clientApiKey}
        jwt={jwt ?? undefined}
        consoleLogLevel="warn"
      >
        {children}
      </CrossmintProvider>
    </CrossmintBoundary>
  );
}

class CrossmintBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn(
      "[agent-commerce] Crossmint provider failed to mount. Save card and verification are disabled.",
      error,
    );
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
