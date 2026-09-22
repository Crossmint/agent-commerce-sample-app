"use client";

import * as React from "react";
import { OrderIntentVerification, type OrderIntentVerificationProps } from "@crossmint/client-sdk-react-ui";
import type { AgentCard } from "@agent-commerce/core";
import { pendingVerificationRails } from "@agent-commerce/core";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils.js";
import { verificationAppearanceFromTheme } from "../lib/appearance.js";
import { railShortLabel } from "../lib/format.js";
import { useAgentCommerce } from "../provider.js";
import { CrossmintScope } from "./crossmint-scope.js";
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
  /**
   * Offers a way back to the card picker. Give it when another card is still
   * a choice — a bank that will not confirm is a reason to try one.
   */
  onUseAnotherCard?: () => void;
  /**
   * Asks for the card again from the top, with the same payment method. It is
   * the retry for a card that came back with no verification step at all,
   * where there is nothing on this screen left to repeat.
   */
  onRetryApproval?: () => void;
  className?: string;
}

/**
 * Wraps Crossmint's `OrderIntentVerification`. The Crossmint component renders
 * a modal over the page and may create a passkey. This component shows what is
 * happening in the space where the Allow button was.
 */
export function VerifyAgentCard({
  agentCard,
  onComplete,
  onError,
  appearance,
  displayName,
  onUseAnotherCard,
  onRetryApproval,
  className,
}: VerifyAgentCardProps) {
  const { crossmint } = useAgentCommerce();
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

  // Both dead ends below are reasons to try another card, so they carry the
  // way back when the screen offers one.
  const anotherCard = onUseAnotherCard ? (
    <Button type="button" variant="secondary" size="xl" className="w-full" onClick={onUseAnotherCard}>
      Use a different card
    </Button>
  ) : null;

  if (!crossmint.clientApiKey) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <Problem title="Verification is not set up" message="The Crossmint client API key is missing." />
        {anotherCard}
      </div>
    );
  }

  if (!agentCard.verificationConfig) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <Problem title="Cannot verify this card" message="The card network did not return a verification step." />
        {/* Nothing on this screen can be repeated, so the retry goes back to
            the top and asks for the card again on the same payment method. */}
        {onRetryApproval ? (
          <Button type="button" size="xl" className="w-full" onClick={onRetryApproval}>
            <ShieldCheck /> Try again
          </Button>
        ) : null}
        {anotherCard}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
        {error ? <AlertCircle aria-hidden className="mt-0.5 size-5 text-destructive" /> : <Spinner className="mt-0.5 size-5 text-primary" />}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{error ? "Verification did not finish" : "Confirm with your bank"}</p>
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
          size="xl"
          className="w-full"
          onClick={() => {
            setError(undefined);
            setAttempt((n) => n + 1);
          }}
        >
          <ShieldCheck /> Try again
        </Button>
      ) : null}
      {error ? anotherCard : onUseAnotherCard ? (
        <Button type="button" variant="link" size="sm" onClick={onUseAnotherCard}>
          Use a different card
        </Button>
      ) : null}
      {canVerify && !error ? (
        <CrossmintScope>
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
        </CrossmintScope>
      ) : null}
    </div>
  );
}

/** A fault, said plainly: the icon, a title, one line. */
function Problem({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3">
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
