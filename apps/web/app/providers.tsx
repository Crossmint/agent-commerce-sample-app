"use client";

import type { ReactNode } from "react";
import { StytchProvider } from "@stytch/nextjs";
import { GoatProvider } from "@goat-wallet/ui";
import { stytch } from "@/lib/stytch-client";
import { useSessionJwt } from "@/lib/use-session-jwt";

export interface ProvidersProps {
  crossmintClientApiKey: string | undefined;
  crossmintEnvironment: "staging" | "production";
  children: ReactNode;
}

/**
 * Stytch owns the session. GOAT reads the session JWT from Stytch and hands it
 * to the GOAT API and to Crossmint. One login, one identity.
 */
export function Providers({ crossmintClientApiKey, crossmintEnvironment, children }: ProvidersProps) {
  if (!stytch) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-xl font-semibold">Auth is not set up</p>
          <p className="text-sm text-muted-foreground">
            Set <code className="font-mono">NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN</code> in your env. See .env.example.
          </p>
        </div>
      </div>
    );
  }
  return (
    <StytchProvider stytch={stytch}>
      <GoatBridge crossmintClientApiKey={crossmintClientApiKey} crossmintEnvironment={crossmintEnvironment}>
        {children}
      </GoatBridge>
    </StytchProvider>
  );
}

function GoatBridge({ crossmintClientApiKey, crossmintEnvironment, children }: ProvidersProps) {
  const { getJwt } = useSessionJwt();
  return (
    <GoatProvider
      apiBaseUrl="/api/goat"
      getJwt={getJwt}
      crossmintClientApiKey={crossmintClientApiKey}
      crossmintEnvironment={crossmintEnvironment}
      mascotSrc="/brand/mark.png"
    >
      {children}
    </GoatProvider>
  );
}
