"use client";

import * as React from "react";
import type { CrossmintEnvironment } from "@agent-commerce/core";
import { createAgentCommerceApi, type GetJwt, type AgentCommerceApi } from "./api/client.js";

export interface AgentCommerceContextValue {
  api: AgentCommerceApi;
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

const AgentCommerceContext = React.createContext<AgentCommerceContextValue | null>(null);

export interface AgentCommerceProviderProps {
  /** Where the Agent Commerce server is mounted. Default "/api/agent-commerce". */
  apiBaseUrl?: string;
  /** Returns the user's session JWT. Called on every API request, and polled for the Crossmint components. */
  getJwt: GetJwt;
  /** Renews the session and returns the new JWT. Called once when a request comes back 401, then the request is sent again. */
  renewJwt?: GetJwt;
  /** Crossmint client API key (`ck_...`). Needed for save card and verification. */
  crossmintClientApiKey?: string;
  crossmintEnvironment?: CrossmintEnvironment;
  /** How often to re-read the JWT for the Crossmint components. Default 30s. */
  jwtRefreshMs?: number;
  /** Default "/crossmint-mark.svg". */
  mascotSrc?: string;
  children: React.ReactNode;
}

/**
 * Wires the Agent Commerce API client to the user's session and hands the same JWT to
 * the Crossmint components (save card, verification) through `CrossmintScope`,
 * so there is one identity everywhere.
 */
export function AgentCommerceProvider({
  apiBaseUrl = "/api/agent-commerce",
  getJwt,
  renewJwt,
  crossmintClientApiKey,
  crossmintEnvironment = "staging",
  jwtRefreshMs = 30_000,
  mascotSrc = "/crossmint-mark.svg",
  children,
}: AgentCommerceProviderProps) {
  const getJwtRef = React.useRef(getJwt);
  getJwtRef.current = getJwt;
  const renewJwtRef = React.useRef(renewJwt);
  renewJwtRef.current = renewJwt;

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
    () =>
      createAgentCommerceApi({
        baseUrl: apiBaseUrl,
        getJwt: () => getJwtRef.current(),
        renewJwt: async () => {
          const renewed = (await renewJwtRef.current?.()) ?? null;
          // The Crossmint components get the new one too.
          if (renewed) setJwt(renewed);
          return renewed;
        },
      }),
    [apiBaseUrl],
  );

  const value = React.useMemo<AgentCommerceContextValue>(
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

  // Crossmint's browser SDK mounts inside <CrossmintScope>, around the one
  // component that needs it. Wrapping the whole app here would change the
  // tree after hydration and remount every page.
  return <AgentCommerceContext.Provider value={value}>{children}</AgentCommerceContext.Provider>;
}

export function useAgentCommerce(): AgentCommerceContextValue {
  const ctx = React.useContext(AgentCommerceContext);
  if (!ctx) throw new Error("useAgentCommerce must be used inside <AgentCommerceProvider>.");
  return ctx;
}

/** Same as useAgentCommerce, but returns null outside a provider. */
export function useAgentCommerceOptional(): AgentCommerceContextValue | null {
  return React.useContext(AgentCommerceContext);
}
