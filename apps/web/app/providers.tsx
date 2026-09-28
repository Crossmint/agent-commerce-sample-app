"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { StytchProvider } from "@stytch/nextjs";
import { AgentCommerceProvider, TooltipProvider } from "@agent-commerce/ui";
import { stytch } from "@/lib/stytch-client";
import { useSessionJwt } from "@/lib/use-session-jwt";

export interface ProvidersProps {
  crossmintClientApiKey: string | undefined;
  crossmintEnvironment: "staging" | "production";
  children: ReactNode;
}

/**
 * Stytch owns the session. The API client reads the session JWT from Stytch
 * and hands it to the Agent Commerce API and to Crossmint. One login, one
 * identity.
 */
export function Providers({ crossmintClientApiKey, crossmintEnvironment, children }: ProvidersProps) {
  const pathname = usePathname();
  if (!stytch) {
    // The landing page needs no auth. Everything else does.
    if (pathname === "/") return <TooltipProvider>{children}</TooltipProvider>;
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
      <ApiBridge crossmintClientApiKey={crossmintClientApiKey} crossmintEnvironment={crossmintEnvironment}>
        <TooltipProvider>{children}</TooltipProvider>
      </ApiBridge>
    </StytchProvider>
  );
}

function ApiBridge({ crossmintClientApiKey, crossmintEnvironment, children }: ProvidersProps) {
  const { getJwt } = useSessionJwt();
  return (
    <AgentCommerceProvider
      apiBaseUrl="/api/agent-commerce"
      getJwt={getJwt}
      crossmintClientApiKey={crossmintClientApiKey}
      crossmintEnvironment={crossmintEnvironment}
      mascotSrc="/crossmint-mark.svg"
    >
      {children}
    </AgentCommerceProvider>
  );
}
