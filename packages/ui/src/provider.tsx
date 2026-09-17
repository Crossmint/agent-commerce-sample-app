"use client";

import * as React from "react";
import { CrossmintProvider } from "@crossmint/client-sdk-react-ui";
import type { CrossmintEnvironment } from "@goat-wallet/core";
import { createGoatApi, type GetJwt, type GoatApi } from "./api/client.js";

export interface GoatContextValue {
  api: GoatApi;
  apiBaseUrl: string;
  /** The latest JWT we resolved from `getJwt`. Null until it resolves or while signed out. */
  jwt: string | null;
  /** Ask `getJwt` again now. */
  refreshJwt: () => Promise<string | null>;
  crossmint: {
    clientApiKey: string | undefined;
    environment: CrossmintEnvironment;
  };
  /** Where the mascot image lives. Components use it in empty and success states. */
  mascotSrc: string;
}

const GoatContext = React.createContext<GoatContextValue | null>(null);

export interface GoatProviderProps {
  /** Where the GOAT server is mounted. Default "/api/goat". */
  apiBaseUrl?: string;
  /** Returns the user's session JWT. Called on every API request, and polled for the Crossmint components. */
  getJwt: GetJwt;
  /** Crossmint client API key (`ck_...`). Needed for save card and verification. */
  crossmintClientApiKey?: string;
  crossmintEnvironment?: CrossmintEnvironment;
  /** How often to re-read the JWT for the Crossmint components. Default 30s. */
  jwtRefreshMs?: number;
  /** Default "/brand/agents/crossmint-agents-mark.svg". */
  mascotSrc?: string;
  children: React.ReactNode;
}

/**
 * Wires the GOAT API client and the Crossmint React SDK to the user's session.
 * Crossmint components (save card, verification) authenticate with the same JWT
 * the GOAT server verifies, so there is one identity everywhere.
 */
export function GoatProvider({
  apiBaseUrl = "/api/goat",
  getJwt,
  crossmintClientApiKey,
  crossmintEnvironment = "staging",
  jwtRefreshMs = 30_000,
  mascotSrc = "/brand/agents/crossmint-agents-mark.svg",
  children,
}: GoatProviderProps) {
  const getJwtRef = React.useRef(getJwt);
  getJwtRef.current = getJwt;

  const [jwt, setJwt] = React.useState<string | null>(null);

  const refreshJwt = React.useCallback(async () => {
    try {
      const next = (await getJwtRef.current()) ?? null;
      setJwt((prev) => (prev === next ? prev : next));
      return next;
    } catch {
      setJwt(null);
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refreshJwt();
    const t = setInterval(() => void refreshJwt(), jwtRefreshMs);
    return () => clearInterval(t);
  }, [refreshJwt, jwtRefreshMs]);

  const api = React.useMemo(
    () => createGoatApi({ baseUrl: apiBaseUrl, getJwt: () => getJwtRef.current() }),
    [apiBaseUrl],
  );

  const value = React.useMemo<GoatContextValue>(
    () => ({
      api,
      apiBaseUrl,
      jwt,
      refreshJwt,
      crossmint: { clientApiKey: crossmintClientApiKey, environment: crossmintEnvironment },
      mascotSrc,
    }),
    [api, apiBaseUrl, jwt, refreshJwt, crossmintClientApiKey, crossmintEnvironment, mascotSrc],
  );

  const inner = <GoatContext.Provider value={value}>{children}</GoatContext.Provider>;

  // Without a client key the GOAT API still works. Only the Crossmint browser
  // components (save card, verification) need it. The Crossmint SDK is
  // browser-only, so it mounts after hydration and never runs during prerender.
  const isClient = useIsClient();
  if (!crossmintClientApiKey || !isClient) return inner;

  return (
    <CrossmintBoundary fallback={inner}>
      <CrossmintProvider apiKey={crossmintClientApiKey} jwt={jwt ?? undefined} consoleLogLevel="warn">
        {inner}
      </CrossmintProvider>
    </CrossmintBoundary>
  );
}

/**
 * The Crossmint SDK validates the API key on mount and throws on a malformed one.
 * A bad or placeholder key must not take the whole app down: the GOAT API, the
 * approval list, and checkouts do not need it. Fall back to rendering without
 * Crossmint and warn once.
 */
class CrossmintBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
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

export function useGoat(): GoatContextValue {
  const ctx = React.useContext(GoatContext);
  if (!ctx) throw new Error("useGoat must be used inside <GoatProvider>.");
  return ctx;
}

/** Same as useGoat, but returns null outside a provider. */
export function useGoatOptional(): GoatContextValue | null {
  return React.useContext(GoatContext);
}
