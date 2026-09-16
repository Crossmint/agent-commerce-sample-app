import Image from "next/image";
import { cn } from "@/lib/cn";
import { CreditCardIcon } from "./icons";

/*
 * The order receipt the agent sends after a checkout. One card for every
 * chat style: merchant tile and order number, the line items, the total,
 * and the card that paid. Sized for the phone: 11-12px text, 12px corners,
 * a hairline border. `tone` is the card's own surface; the thread around
 * it can be anything.
 */

export interface ReceiptLine {
  label: string;
  amount: string;
}

export interface ReceiptCardProps {
  tone?: "light" | "dark";
  merchant?: string;
  order?: string;
  lines?: ReceiptLine[];
  total?: string;
  /** The card that paid, e.g. "Visa •••• 4242". */
  card?: string;
  className?: string;
}

const LINES: ReceiptLine[] = [
  { label: "Grande Latte", amount: "$5.95" },
  { label: "Pickup", amount: "$0.00" },
  { label: "Tax", amount: "$0.50" },
];

const SKIN = {
  light: { card: "border-black/10 bg-white text-[#0a0a0a]", muted: "text-black/50", line: "border-black/8" },
  dark: { card: "border-white/12 bg-[#1c1c1e] text-white", muted: "text-white/55", line: "border-white/10" },
} as const;

export function ReceiptCard({ tone = "light", merchant = "Starbucks", order = "#4471-9021", lines = LINES, total = "$6.45", card = "Visa •••• 4242", className }: ReceiptCardProps) {
  const s = SKIN[tone];
  return (
    <div className={cn("flex w-full flex-col gap-2 rounded-[12px] border px-3 py-2.5 text-left text-[11.5px] leading-tight antialiased", s.card, className)}>
      <div className="flex items-center gap-2">
        <MerchantTile merchant={merchant} />
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate text-[12px] font-semibold">{merchant}</span>
          <span className={cn("truncate text-[10.5px]", s.muted)}>Order {order}</span>
        </div>
      </div>
      <hr className={cn("border-t", s.line)} />
      <div className="flex flex-col gap-1">
        {lines.map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{l.label}</span>
            <span className="shrink-0 tabular-nums">{l.amount}</span>
          </div>
        ))}
      </div>
      <hr className={cn("border-t", s.line)} />
      <div className="flex items-baseline justify-between gap-3 text-[12px] font-semibold">
        <span>Paid</span>
        <span className="tabular-nums">{total}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <CreditCardIcon width={13} height={13} strokeWidth={2} className={cn("shrink-0", s.muted)} />
          <span className="truncate">{card}</span>
        </span>
        <span className={cn("shrink-0", s.muted)}>Approved</span>
      </div>
    </div>
  );
}

/** A rounded square in the merchant's color. Starbucks: the siren, white on #00704A. Other merchants: their initial on gray. */
function MerchantTile({ merchant }: { merchant: string }) {
  if (merchant.toLowerCase() === "starbucks") {
    return (
      <span aria-hidden className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[#00704A]">
        <Image src="/logos/starbucks.svg" alt="" width={18} height={18} unoptimized className="size-[18px]" />
      </span>
    );
  }
  return (
    <span aria-hidden className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[#3a3a3c] text-[14px] leading-none font-extrabold text-white">
      {merchant.charAt(0).toUpperCase()}
    </span>
  );
}
