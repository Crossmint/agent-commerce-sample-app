"use client";

import * as React from "react";
import { CrossmintProtectedInput } from "@crossmint/client-sdk-react-ui";
import { AlertCircle, Lock, RotateCw } from "lucide-react";
import { errorMessage } from "../api/client.js";
import type { CheckoutView } from "../api/types.js";
import { cn } from "../lib/utils.js";
import { paymentMethodAppearanceFromTheme } from "../lib/appearance.js";
import { useAgentCommerce } from "../provider.js";
import { CrossmintScope } from "./crossmint-scope.js";
import { Button } from "./primitives/button.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";

type ProtectedInputSdkProps = React.ComponentProps<typeof CrossmintProtectedInput>;
export type ProtectedInputAppearance = NonNullable<ProtectedInputSdkProps["appearance"]>;
export type ProtectedInputError = Parameters<NonNullable<ProtectedInputSdkProps["onError"]>>[0];

export interface ProtectedInputProps {
  /** The store the secret is for, as the request names it: "shop.example.com". */
  merchantDomain: string;
  /** Text above the field. Default "Password for <domain>". */
  label?: string;
  /** Fires once with the opaque id to answer the request with. Never the password. */
  onCreated: (protectedInputId: string) => void;
  onError?: (error: ProtectedInputError) => void;
  /** Passed to Crossmint's `CrossmintProtectedInput`. Defaults to the page theme. */
  appearance?: ProtectedInputAppearance;
  /** Who the reassurance says cannot see the password: the company behind the app. Default "This app". */
  platformName?: string;
  className?: string;
}

/**
 * How long Crossmint's field may take to show itself. Its iframe has no
 * height until the hosted page reports one, and a page that fails before
 * then reports nothing, not even an error: without a limit the field would
 * stay an empty space.
 */
const FIELD_LOAD_TIMEOUT_MS = 10_000;

/**
 * Wraps Crossmint's `CrossmintProtectedInput`: the password of the buyer's
 * account at a store, typed into a field Crossmint hosts. The field is
 * Crossmint's own iframe, so the password goes straight to its vault and
 * never reaches this app, the agent or the chat, the same bargain the card
 * form and the security code make. What comes back is an opaque id, bound to
 * the store's domain, that Agent Checkouts reads the password with on that
 * store's sign-in page alone.
 */
export function ProtectedInput({
  merchantDomain,
  label,
  onCreated,
  onError,
  appearance,
  platformName = "This app",
  className,
}: ProtectedInputProps) {
  const { crossmint, jwt } = useAgentCommerce();
  const [attempt, setAttempt] = React.useState(0);
  const [error, setError] = React.useState<ProtectedInputError | undefined>(undefined);
  // Whether the field has shown itself, and whether it has had too long to.
  const [shown, setShown] = React.useState(false);
  const [stalled, setStalled] = React.useState(false);
  // The field's box, once it has mounted: the SDK mounts after hydration, inside CrossmintScope.
  const [fieldEl, setFieldEl] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!fieldEl) return;
    const watch = new ResizeObserver(() => {
      if (fieldEl.offsetHeight > 0) setShown(true);
    });
    watch.observe(fieldEl);
    const t = setTimeout(() => setStalled(true), FIELD_LOAD_TIMEOUT_MS);
    return () => {
      watch.disconnect();
      clearTimeout(t);
    };
  }, [fieldEl, attempt]);
  const [themeAppearance, setThemeAppearance] = React.useState<
    ProtectedInputAppearance | undefined
  >(undefined);

  React.useEffect(() => {
    if (appearance) return;
    // The field renders one input, so the button rules have nothing to style.
    const theme = paymentMethodAppearanceFromTheme();
    if (theme) setThemeAppearance({ variables: theme.variables });
  }, [appearance]);

  if (!crossmint.clientApiKey) {
    return (
      <Problem
        className={className}
        title="The password cannot be asked for here"
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

  // The parameters are wrong or the vault cannot load: typing again cannot fix it.
  if (error && error.code !== "protected_input_failed") {
    return (
      <Problem
        className={className}
        title="The password field could not load"
        message={`${error.message} Try again later.`}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {error || (stalled && !shown) ? (
        <div className="flex flex-col gap-3">
          {error ? (
            <Problem title="That did not go through" message={error.message} />
          ) : (
            <Problem
              title="The password field did not load"
              message="Crossmint's secure field did not start. Protected inputs must be enabled on the Crossmint project, the client key needs the protected-inputs.create scope, and this site's origin must be allowed on it."
            />
          )}
          <Button
            type="button"
            size="xl"
            className="w-full"
            onClick={() => {
              setError(undefined);
              setStalled(false);
              setShown(false);
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
            Encrypted and only used on {siteName(merchantDomain)}. {platformName} never sees it.
          </p>
          <CrossmintScope
            fallback={<Skeleton className="h-24" />}
            failedFallback={
              <Problem
                title="The password field could not load"
                message="Crossmint's component did not start. Check the browser console, and that this site's origin is allowed on the Crossmint client key."
              />
            }
          >
            {/* The field has no height until Crossmint's page loads; until then, a placeholder. */}
            {shown ? null : <Skeleton className="h-24" />}
            <div ref={setFieldEl}>
              <CrossmintProtectedInput
                key={attempt}
                jwt={jwt}
                merchantUrl={`https://${merchantDomain}`}
                label={label ?? `Password for ${merchantDomain}`}
                appearance={appearance ?? themeAppearance}
                onCreated={({ protectedInputId }) => onCreated(protectedInputId)}
                onError={(e) => {
                  setError(e);
                  onError?.(e);
                }}
              />
            </div>
          </CrossmintScope>
        </>
      )}
    </div>
  );
}

/** "www.amazon.com" → "amazon.com", for reading. The field itself is bound to the domain as given. */
function siteName(domain: string): string {
  return domain.replace(/^www\./, "");
}

export type PasswordRequestOutcome = "submitted" | "declined";

export interface AnswerPasswordRequestProps {
  checkoutId: string;
  /** The open request that asks for the password. */
  requestId: string;
  merchantDomain: string;
  /** The heading is left to a host that asks in its own words. Default true. */
  showHeading?: boolean;
  /** Who cannot see the password, for the reassurance under the heading. */
  platformName?: string;
  /** Fires once the run has the answer, with the view the server returned. */
  onDone?: (outcome: PasswordRequestOutcome, view?: CheckoutView) => void;
  className?: string;
}

/**
 * A store's password request, answered: Crossmint's protected field, and
 * once the buyer has typed the password, the run answered with the id it
 * returned. "Not now" declines the request instead, and the store's agent
 * carries on without signing in, or asks another way.
 */
export function AnswerPasswordRequest({
  checkoutId,
  requestId,
  merchantDomain,
  showHeading = true,
  platformName,
  onDone,
  className,
}: AnswerPasswordRequestProps) {
  const { api } = useAgentCommerce();
  const [state, setState] = React.useState<"typing" | "sending" | "sent" | "declined">("typing");
  const [failure, setFailure] = React.useState<unknown>(undefined);

  const send = async (protectedInputId: string) => {
    setState("sending");
    setFailure(undefined);
    try {
      const view = await api.answerCheckout(checkoutId, { requestId, protectedInputId });
      setState("sent");
      onDone?.("submitted", view);
    } catch (e) {
      setFailure(e);
      setState("typing");
    }
  };

  const decline = async () => {
    setState("sending");
    setFailure(undefined);
    try {
      const view = await api.answerCheckout(checkoutId, { requestId, action: "decline" });
      setState("declined");
      onDone?.("declined", view);
    } catch (e) {
      setFailure(e);
      setState("typing");
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {showHeading ? (
        <h1 className="text-xl font-medium text-balance text-foreground">
          Sign in to {siteName(merchantDomain)}
        </h1>
      ) : null}
      {state === "sent" || state === "declined" ? (
        <p className="text-sm text-muted-foreground">
          {state === "sent"
            ? "Sent. The agent is signing in to the store."
            : "Skipped. The agent carries on without signing in."}
        </p>
      ) : (
        <>
          {failure ? (
            <Problem title="Could not send it to the store" message={errorMessage(failure)} />
          ) : null}
          {state === "sending" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Sending it to the store…
            </div>
          ) : (
            <ProtectedInput
              merchantDomain={merchantDomain}
              platformName={platformName}
              onCreated={(id) => void send(id)}
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="xl"
            className="w-full"
            disabled={state === "sending"}
            onClick={() => void decline()}
          >
            Not now
          </Button>
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
