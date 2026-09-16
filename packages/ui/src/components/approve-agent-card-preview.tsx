import * as React from "react";
import { ChevronDown, CreditCard, Lock } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./primitives/button.js";

export interface ApproveAgentCardPreviewProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Name of the agent in the headline. Default "GOAT". */
  agentName?: string;
  /** Purpose line. Default "Grande latte at Starbucks". */
  purpose?: string;
  /** Limit line, already formatted. Default "$8.00". */
  limit?: string;
  /** Shown in the card select. Default "Visa •••• 4242". */
  cardLabel?: string;
  /** Optional Merchant line. Hidden when empty. */
  merchant?: string;
  /** Optional Expires line. Hidden when empty. */
  expires?: string;
  allowLabel?: string;
  denyLabel?: string;
  /** Heading font. Default: inherit. Use it for brand demos. */
  headingFontFamily?: string;
}

/**
 * A static replica of the approval screen for marketing pages and brand demos.
 * Same structure as `ApproveAgentCard`, no data and no API calls.
 *
 * It reads the shadcn theme tokens (`--background`, `--card`, `--primary`,
 * `--radius`, ...) so a wrapper that sets those variables restyles it. Two extra
 * variables are optional: `--radius-button` for the Allow button (default: the
 * theme radius)
 * and `--font-heading` for the headline (default: inherit).
 */
export function ApproveAgentCardPreview({
  agentName = "GOAT",
  purpose = "Grande latte at Starbucks",
  limit = "$8.00",
  cardLabel = "Visa •••• 4242",
  merchant,
  expires,
  allowLabel = "Allow",
  denyLabel = "Deny",
  headingFontFamily,
  className,
  ...props
}: ApproveAgentCardPreviewProps) {
  return (
    <div
      data-slot="approve-preview"
      aria-label={`Preview: ${agentName} is requesting to use your card`}
      className={cn(
        "mx-auto flex w-full max-w-md flex-col gap-5 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-7",
        className,
      )}
      {...props}
    >
      <p
        className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl"
        style={{ fontFamily: headingFontFamily ?? "var(--font-heading, inherit)" }}
      >
        {agentName} is requesting to use your card
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Purpose</dt>
        <dd className="font-medium">{purpose}</dd>
        <dt className="text-muted-foreground">Limit</dt>
        <dd className="font-medium">{limit}</dd>
        {merchant ? (
          <>
            <dt className="text-muted-foreground">Merchant</dt>
            <dd className="font-medium">{merchant}</dd>
          </>
        ) : null}
        {expires ? (
          <>
            <dt className="text-muted-foreground">Expires</dt>
            <dd className="font-medium">{expires}</dd>
          </>
        ) : null}
      </dl>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium leading-none">Choose card</span>
        {/* Looks like the real select. Not a control: this is a picture of one. */}
        <div
          aria-hidden
          className="relative flex h-11 w-full items-center rounded-xl border border-input bg-background pr-10 pl-10 text-sm text-foreground shadow-xs"
        >
          <CreditCard className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="truncate">{cardLabel}</span>
          <ChevronDown className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Your card number is never shared with the agent or the store.
      </p>

      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          size="lg"
          tabIndex={-1}
          aria-hidden
          className="w-full cursor-default"
          style={{ borderRadius: "var(--radius-button, var(--radius))" }}
        >
          {allowLabel}
        </Button>
        <span className="text-xs font-semibold text-muted-foreground underline-offset-4">{denyLabel}</span>
      </div>
    </div>
  );
}
