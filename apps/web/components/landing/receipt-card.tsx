import Image from "next/image";
import { CreditCard } from "lucide-react";
import { cn } from "@/lib/cn";
import { STORY } from "./story";

/*
 * The order receipt the agent sends after a checkout: merchant tile and
 * order number, the line items, the total, and the card that paid. Sized
 * for the phone: 11-12px text. A card in the theme's own terms: white,
 * 16px corners, a hairline ring.
 *
 * The merchant tile carries Starbucks' siren in white on Starbucks green,
 * the one place on the page that wears a real merchant's mark: a receipt with
 * a letter tile on it does not read as a receipt.
 */

/** Starbucks green, from the brand's own palette. */
const STARBUCKS_GREEN = "#00704A";

export function ReceiptCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-2 rounded-2xl bg-card px-3 py-2.5 text-left text-[11.5px] leading-tight text-card-foreground ring-1 ring-foreground/10", className)}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: STARBUCKS_GREEN }}
        >
          <Image src="/logos/starbucks.svg" alt="" width={18} height={18} className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate text-[12px] font-semibold">{STORY.merchant}</span>
          <span className="truncate text-[10.5px] text-muted-foreground">Order #{STORY.order}</span>
        </div>
      </div>
      <hr className="border-t border-border" />
      <div className="flex flex-col gap-1">
        {STORY.receipt.lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{l.label}</span>
            <span className="shrink-0 tabular-nums">{l.amount}</span>
          </div>
        ))}
      </div>
      <hr className="border-t border-border" />
      <div className="flex items-baseline justify-between gap-3 text-[12px] font-semibold">
        <span>Paid</span>
        <span className="font-display tabular-nums">{STORY.receipt.total}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CreditCard className="size-[13px] shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="truncate">{STORY.card}</span>
        </span>
        <span className="shrink-0 text-muted-foreground">Approved</span>
      </div>
    </div>
  );
}
