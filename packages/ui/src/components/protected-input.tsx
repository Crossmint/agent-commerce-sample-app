"use client";

import * as React from "react";
import {
  CrossmintProtectedInput,
  type CrossmintProtectedInputRef,
  type ProtectedInputAppearance,
} from "@crossmint/client-sdk-react-ui";
import type { CheckoutProtectedField } from "@agent-commerce/core";
import { AlertCircle, Lock, RotateCw } from "lucide-react";
import { cn } from "../lib/utils.js";
import { paymentMethodAppearanceFromTheme } from "../lib/appearance.js";
import { useAgentCommerce } from "../provider.js";
import { CrossmintScope } from "./crossmint-scope.js";
import { Button } from "./primitives/button.js";
import { Label } from "./primitives/label.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";

export type { ProtectedInputAppearance };

export interface ProtectedFieldProps {
  /** The protected field, exactly as the checkout's request describes it. */
  field: CheckoutProtectedField;
  /** Shown under the field: why the last collection failed. Crossmint's field shows no error text itself. */
  error?: string;
  disabled?: boolean;
  /** Passed to Crossmint's `CrossmintProtectedInput`. Defaults to the page theme. */
  appearance?: ProtectedInputAppearance;
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
 * One protected field of a checkout's form, such as the password of the
 * buyer's account at a store: Crossmint's `CrossmintProtectedInput`, with the
 * label, the error and the load states around it. The field is Crossmint's
 * own iframe, so the secret goes straight to its vault and never reaches
 * this app, the agent or the chat, the same bargain the card form and the
 * security code make.
 *
 * The ref is Crossmint's: `collect()` stores what was typed and resolves
 * `{ status: "collected", input: { protectedInputId } }`, the answer for this
 * field, or why it could not.
 */
export const ProtectedField = React.forwardRef<CrossmintProtectedInputRef, ProtectedFieldProps>(
  function ProtectedField({ field, error, disabled, appearance, className }, ref) {
    const { crossmint, jwt } = useAgentCommerce();
    const id = React.useId();
    const [attempt, setAttempt] = React.useState(0);
    // Whether the field has shown itself, and whether it has had too long to.
    const [shown, setShown] = React.useState(false);
    const [stalled, setStalled] = React.useState(false);
    // The field's box, once it has mounted: the SDK mounts after hydration, inside CrossmintScope.
    const [fieldEl, setFieldEl] = React.useState<HTMLDivElement | null>(null);
    const [themeAppearance, setThemeAppearance] = React.useState<
      ProtectedInputAppearance | undefined
    >(undefined);

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

    React.useEffect(() => {
      if (appearance) return;
      // The field renders one input, so the button rules have nothing to style.
      const theme = paymentMethodAppearanceFromTheme();
      if (theme) setThemeAppearance({ variables: theme.variables });
    }, [appearance]);

    const label = (
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <Lock aria-hidden className="size-3.5 text-muted-foreground" />
        {field.label}
        {field.required ? <span className="text-destructive">*</span> : null}
      </Label>
    );

    let body: React.ReactNode;
    if (!crossmint.clientApiKey) {
      body = (
        <Problem
          title="The secure field cannot load here"
          message="The Crossmint client API key is missing."
        />
      );
    } else if (!jwt) {
      body = (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Waiting for your session…
        </div>
      );
    } else if (stalled && !shown) {
      body = (
        <div className="flex flex-col gap-3">
          <Problem
            title="The secure field did not load"
            message="Crossmint's secure field did not start. Protected inputs must be enabled on the Crossmint project, the client key needs the protected-inputs.create scope, and this site's origin must be allowed on it."
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setStalled(false);
              setShown(false);
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCw /> Try again
          </Button>
        </div>
      );
    } else {
      body = (
        <CrossmintScope
          fallback={<Skeleton className="h-12" />}
          failedFallback={
            <Problem
              title="The secure field could not load"
              message="Crossmint's component did not start. Check the browser console, and that this site's origin is allowed on the Crossmint client key."
            />
          }
        >
          {/* The field has no height until Crossmint's page loads; until then, a placeholder. */}
          {shown ? null : <Skeleton className="h-12" />}
          <div id={id} ref={setFieldEl}>
            <CrossmintProtectedInput
              key={attempt}
              ref={ref}
              jwt={jwt}
              field={field}
              disabled={disabled}
              invalid={Boolean(error)}
              appearance={appearance ?? themeAppearance}
            />
          </div>
        </CrossmintScope>
      );
    }

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {label}
        {body}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

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
