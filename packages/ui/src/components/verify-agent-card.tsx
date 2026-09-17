"use client";

import * as React from "react";
import { OrderIntentVerification, type OrderIntentVerificationProps } from "@crossmint/client-sdk-react-ui";
import type { AgentCard } from "@goat-wallet/core";
import { pendingVerificationRails } from "@goat-wallet/core";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "../lib/utils.js";
import { verificationAppearanceFromTheme } from "../lib/appearance.js";
import { railShortLabel } from "../lib/format.js";
import { useGoat } from "../provider.js";
import { Alert, AlertDescription, AlertTitle } from "./primitives/alert.js";
import { Button } from "./primitives/button.js";
import { Spinner } from "./primitives/spinner.js";

export type VerificationAppearance = NonNullable<OrderIntentVerificationProps["appearance"]>;

export interface VerifyAgentCardProps {
  agentCard: AgentCard;
  onComplete: () => void;
  onError?: (error: unknown) => void;
  /** Passed to Crossmint's `OrderIntentVerification`. Defaults to the page theme. */
  appearance?: VerificationAppearance;
  /** Name shown in the bank's verification prompt. */
  displayName?: string;
  className?: string;
}

/**
 * Wraps Crossmint's `OrderIntentVerification`. The Crossmint component renders
 * a modal over the page and may create a passkey. This component shows what is
 * happening in the space where the Allow button was.
 */
export function VerifyAgentCard({ agentCard, onComplete, onError, appearance, displayName, className }: VerifyAgentCardProps) {
  const { crossmint } = useGoat();
  const [attempt, setAttempt] = React.useState(0);
  const [error, setError] = React.useState<unknown>(undefined);
  const [themeAppearance, setThemeAppearance] = React.useState<VerificationAppearance | undefined>(undefined);

  React.useEffect(() => {
    if (!appearance) setThemeAppearance(verificationAppearanceFromTheme());
  }, [appearance]);

  const pending = pendingVerificationRails(agentCard);
  const canVerify = Boolean(crossmint.clientApiKey) && Boolean(agentCard.verificationConfig);

  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;
  React.useEffect(() => {
    if (!agentCard.verificationConfig) {
      onErrorRef.current?.(new Error("This agent card has no verification config."));
    }
  }, [agentCard.verificationConfig]);

  if (!crossmint.clientApiKey) {
    return (
      <Alert variant="destructive" className={className}>
        <TriangleAlert />
        <AlertTitle>Verification is not set up</AlertTitle>
        <AlertDescription>The Crossmint client API key is missing.</AlertDescription>
      </Alert>
    );
  }

  if (!agentCard.verificationConfig) {
    return (
      <Alert variant="destructive" className={className}>
        <TriangleAlert />
        <AlertTitle>Cannot verify this card</AlertTitle>
        <AlertDescription>The card network did not return a verification step.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
        {error ? <TriangleAlert className="mt-0.5 size-5 text-destructive" /> : <Spinner className="mt-0.5 size-5 text-primary" />}
        <div className="flex-1 space-y-1">
          <p className="font-semibold">{error ? "Verification did not finish" : "Confirm with your bank"}</p>
          <p className="text-sm text-muted-foreground">
            {error
              ? "Try again. Nothing was charged."
              : "A window opens. Follow the steps. This may create a passkey."}
          </p>
          {pending.length ? (
            <p className="text-xs text-muted-foreground">
              {pending.map((r) => railShortLabel(r)).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            setError(undefined);
            setAttempt((n) => n + 1);
          }}
        >
          <ShieldCheck /> Try again
        </Button>
      ) : null}
      {canVerify && !error ? (
        <OrderIntentVerification
          key={attempt}
          orderIntent={agentCard as unknown as OrderIntentVerificationProps["orderIntent"]}
          displayName={displayName}
          appearance={appearance ?? themeAppearance}
          onVerificationComplete={onComplete}
          onVerificationError={(e) => {
            setError(e ?? new Error("Verification failed"));
            onError?.(e);
          }}
        />
      ) : null}
    </div>
  );
}
