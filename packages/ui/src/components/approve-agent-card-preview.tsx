import * as React from "react";
import { ChevronDown, CreditCard, Lock } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./primitives/button.js";

export interface ApproveAgentCardPreviewProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Name of the agent in the headline. Default "Your agent". */
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
 * `--radius`, ...) so a wrapper that sets those variables restyles it.
 */
export function ApproveAgentCardPreview({
  agentName = "Your agent",
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
      className={cn("mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10", className)}
      {...props}
    >
      <div className="flex flex-col gap-2">
        <p className="text-xl font-medium text-balance" style={headingFontFamily ? { fontFamily: headingFontFamily } : undefined}>
          {agentName} is requesting to use your card
        </p>
        <p className="text-sm text-muted-foreground">Approve it once, for this budget only.</p>
      </div>

      <dl className="flex flex-col rounded-2xl border border-border px-5">
        <Row label="Purpose">{purpose}</Row>
        <Row label="Limit" strong>
          {limit}
        </Row>
        {merchant ? <Row label="Merchant">{merchant}</Row> : null}
        {expires ? <Row label="Expires">{expires}</Row> : null}
      </dl>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Choose card</span>
        {/* Looks like the real select. Not a control: this is a picture of one. */}
        <div aria-hidden className="relative flex h-12 w-full items-center rounded-xl bg-muted pr-10 pl-11 text-sm text-foreground">
          <CreditCard className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="truncate">{cardLabel}</span>
          <ChevronDown className="absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Your card is never shared with the agent.
      </p>

      <div className="flex flex-col gap-2">
        <Button type="button" size="xl" tabIndex={-1} aria-hidden className="w-full cursor-default">
          {allowLabel}
        </Button>
        <Button type="button" variant="secondary" size="xl" tabIndex={-1} aria-hidden className="w-full cursor-default">
          {denyLabel}
        </Button>
      </div>
    </div>
  );
}

/** One line of the request, as on the live screen. */
function Row({ label, strong = false, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-0">
      <dt className={cn("shrink-0 text-sm", strong ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("min-w-0 text-right text-sm", strong ? "font-semibold tabular-nums" : "font-medium")}>{children}</dd>
    </div>
  );
}
