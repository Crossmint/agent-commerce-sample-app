import { Cloud, Lock } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import { cn } from "@/lib/cn";
import type { ApproveLayoutProps } from "./types";

/**
 * Nimbus layout: a full-height sheet. Brand bar on top, the amount as the hero
 * of the screen, purpose under it, a horizontal card carousel, and a sticky
 * bottom bar with Allow and Not now side by side.
 */
export function NimbusApprove({ agentName = "Your agent" }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex items-center justify-between bg-primary px-4 py-2.5 text-primary-foreground">
        <span className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
          <Cloud className="size-4" strokeWidth={2.5} />
          nimbus
        </span>
        <span className="text-[10.5px] font-medium opacity-80">Secure approval</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center px-4 pt-6 text-center">
        <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{agentName} wants to spend up to</p>
        <p className="mt-1.5 text-[44px] leading-none font-bold tracking-tight tabular-nums">$8.00</p>
        <p className="mt-2 text-[13px] text-muted-foreground">Grande latte at Starbucks</p>

        <div className="mt-6 w-full">
          <p className="mb-2 text-left text-[11.5px] font-semibold">Pay with</p>
          <div className="-mx-4 flex gap-2.5 overflow-hidden px-4">
            <MiniCard network="Visa" last4="4242" selected className="from-[#4f46e5] to-[#312e81]" />
            <MiniCard network="Mastercard" last4="8812" className="from-[#475569] to-[#1e293b]" />
          </div>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <Lock className="size-3" />
          The card number stays with Crossmint.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border bg-card px-3 pt-3 pb-3">
        <Button type="button" variant="outline" tabIndex={-1} aria-hidden className="h-10 cursor-default rounded-full bg-background text-[13px]">
          Not now
        </Button>
        <Button type="button" tabIndex={-1} aria-hidden className="h-10 cursor-default rounded-full text-[13px]">
          Allow
        </Button>
      </div>
    </div>
  );
}

function MiniCard({ network, last4, selected = false, className }: { network: string; last4: string; selected?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-[82px] w-[148px] shrink-0 flex-col justify-between rounded-[14px] bg-gradient-to-br p-3 text-left text-white",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-80",
        className,
      )}
    >
      <span className="text-[11px] font-semibold">{network}</span>
      <span className="text-[12px] tracking-widest tabular-nums">•••• {last4}</span>
    </div>
  );
}
