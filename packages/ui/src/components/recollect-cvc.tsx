"use client";

import * as React from "react";
import { CrossmintCvcRecollection } from "@crossmint/client-sdk-react-ui";
import { AlertCircle, Lock, RotateCw } from "lucide-react";
import { cn } from "../lib/utils.js";
import { paymentMethodAppearanceFromTheme } from "../lib/appearance.js";
import { useAgentCommerce } from "../provider.js";
import { CrossmintScope } from "./crossmint-scope.js";
import { Button } from "./primitives/button.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";

type RecollectionProps = React.ComponentProps<typeof CrossmintCvcRecollection>;
export type CvcAppearance = NonNullable<RecollectionProps["appearance"]>;
export type CvcError = Parameters<NonNullable<RecollectionProps["onError"]>>[0];

export interface RecollectCvcProps {
  /** The saved card whose vaulted security code lapsed. */
  paymentMethodId: string;
  /** Fires once Crossmint's vault holds a fresh code. Refetch the agent cards here. */
  onComplete: () => void;
  onError?: (error: CvcError) => void;
  /** Passed to Crossmint's `CrossmintCvcRecollection`. Defaults to the page theme. */
  appearance?: CvcAppearance;
  className?: string;
}

/**
 * Wraps Crossmint's `CrossmintCvcRecollection`: the three digits of a saved
 * card, asked for again.
 *
 * Crossmint holds a card's security code in its vault only for a while. When
 * that copy lapses, the rails behind the card report
 * `pending_cvc_recollection` and mint nothing until the user types the digits
 * again. The field below is Crossmint's own iframe, so the digits go straight
 * to the vault and never reach this app — the same bargain the card form
 * makes, which is why this takes `paymentMethodAppearanceFromTheme` rather
 * than the verification appearance.
 *
 * It is keyed by the saved card, not by the budget: one card can back several
 * budgets, and typing the code once clears all of them.
 */
export function RecollectCvc({
  paymentMethodId,
  onComplete,
  onError,
  appearance,
  className,
}: RecollectCvcProps) {
  const { crossmint, jwt } = useAgentCommerce();
  const [attempt, setAttempt] = React.useState(0);
  const [error, setError] = React.useState<CvcError | undefined>(undefined);
  const [themeAppearance, setThemeAppearance] = React.useState<CvcAppearance | undefined>(undefined);

  React.useEffect(() => {
    if (!appearance) setThemeAppearance(paymentMethodAppearanceFromTheme());
  }, [appearance]);

  if (!crossmint.clientApiKey) {
    return (
      <Problem
        className={className}
        title="The security code cannot be asked for here"
        message="The Crossmint client API key is missing."
      />
    );
  }

  if (!jwt) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Spinner /> Waiting for your session…
      </div>
    );
  }

  // `retriable: false` means the field is dead and typing again cannot fix it.
  if (error && !error.retriable) {
    return (
      <Problem
        className={className}
        title="The security code could not be saved"
        message={`${error.message} Try again later, or remove the card and add it back.`}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {error ? (
        <div className="flex flex-col gap-3">
          <Problem title="That did not go through" message={error.message} />
          <Button
            type="button"
            size="xl"
            className="w-full"
            onClick={() => {
              setError(undefined);
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCw /> Try again
          </Button>
        </div>
      ) : (
        <>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            The digits go straight to Crossmint. Neither this app nor your agent sees them.
          </p>
          <CrossmintScope
            fallback={<Skeleton className="h-24" />}
            failedFallback={
              <Problem
                title="The security code field could not load"
                message="Crossmint's component did not start. Check the browser console, and that this site's origin is allowed on the Crossmint client key."
              />
            }
          >
            <CrossmintCvcRecollection
              key={attempt}
              jwt={jwt}
              paymentMethodId={paymentMethodId}
              appearance={appearance ?? themeAppearance}
              onComplete={onComplete}
              onError={(e) => {
                setError(e);
                onError?.(e);
              }}
            />
          </CrossmintScope>
        </>
      )}
    </div>
  );
}

/** A fault, said plainly: the icon, a title, one line. */
function Problem({
  title,
  message,
  className,
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex items-start gap-3", className)}>
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
