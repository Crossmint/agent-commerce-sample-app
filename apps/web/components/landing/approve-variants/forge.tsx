import { Check, CreditCard } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import type { ApproveLayoutProps } from "./types";

/**
 * Forge layout: a receipt. Terminal-like header, a monospace details table
 * with dotted leaders, a compact card row with a Change link, a merchant lock
 * checkbox, a lime full-width Approve and a small Reject text button.
 */
export function ForgeApprove({ agentName = "Your agent" }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-background font-mono text-[12px] text-foreground">
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 text-[10.5px] text-muted-foreground">
        <span aria-hidden className="size-2 rounded-full bg-primary" />
        <span className="text-foreground">forge.tools/approve</span>
        <span className="ml-auto">sess_8f2a</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-4 pt-4">
        <p className="truncate font-semibold">
          <span className="text-muted-foreground">$ </span>agent-card request <span className="text-primary">--limit 8</span>
        </p>

        <dl className="flex flex-col gap-1.5">
          <Row k="Agent" v={agentName} />
          <Row k="Purpose" v="Grande latte" />
          <Row k="Limit" v="$8.00" />
          <Row k="Card" v="Visa •••• 4242" />
          <Row k="Expires" v="24h" />
        </dl>

        <div className="flex items-center justify-between rounded-[6px] border border-border bg-card px-3 py-2">
          <span className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            Visa •••• 4242
          </span>
          <span className="text-primary underline underline-offset-2">Change</span>
        </div>

        <p className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="inline-flex size-4 items-center justify-center rounded-[3px] bg-primary text-primary-foreground">
            <Check className="size-3" strokeWidth={3} />
          </span>
          Lock to this merchant
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-4">
        <Button type="button" tabIndex={-1} aria-hidden className="h-10 w-full cursor-default rounded-[6px] font-mono text-[13px] font-bold tracking-wide uppercase">
          Approve
        </Button>
        <span className="text-[11px] text-muted-foreground">Reject</span>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <span aria-hidden className="flex-1 -translate-y-[3px] border-b border-dotted border-muted-foreground/45" />
      <dd className="text-right">{v}</dd>
    </div>
  );
}
