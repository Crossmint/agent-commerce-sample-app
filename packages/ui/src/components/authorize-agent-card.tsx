"use client";

import {
  CrossmintAgentCardAuthorization,
  type CrossmintAgentCardAuthorizationProps,
} from "@crossmint/client-sdk-react-ui";
import { useAgentCommerce } from "../provider.js";
import { CrossmintScope } from "./crossmint-scope.js";

export type AuthorizeAgentCardProps = Omit<CrossmintAgentCardAuthorizationProps, "jwt">;

/** Supplies the current session while preserving the SDK's props and callbacks. */
export function AuthorizeAgentCard({ onAuthorized, onError, ...props }: AuthorizeAgentCardProps) {
  const { jwt, crossmint } = useAgentCommerce();

  if (!crossmint.clientApiKey) {
    return <p role="alert">Missing Crossmint client API key.</p>;
  }

  if (!jwt) {
    return <p role="status">Waiting for your session…</p>;
  }

  return (
    <CrossmintScope
      fallback={<p role="status">Loading card authorization…</p>}
      failedFallback={<p role="alert">Card authorization could not load.</p>}
    >
      <CrossmintAgentCardAuthorization
        {...props}
        jwt={jwt}
        onAuthorized={(result) => {
          // Keep diagnostics explicit: never log the full result or card details.
          console.info("[sdk-evaluation] authorization.completed", {
            orderIntentId: result.orderIntentId,
            rail: result.rail.rail,
            provider: result.rail.provider,
          });
          onAuthorized(result);
        }}
        onError={(error) => {
          console.warn("[sdk-evaluation] authorization.failed", { code: error.code });
          onError(error);
        }}
      />
    </CrossmintScope>
  );
}
