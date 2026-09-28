"use client";

import type { ReactNode } from "react";
import {
  CalendarCheck,
  CreditCard,
  Plane,
  ReceiptText,
  ShoppingBag,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { PaymentMethod } from "@agent-commerce/core";
import { CardMark } from "@agent-commerce/ui";
import { SiteIcon } from "@/components/chat/checkout-site";
import { cn } from "@/lib/cn";
import type { ReceiptKind } from "@/lib/receipt";

export type { ReceiptKind };

/*
 * The receipt the agent sends when a checkout is done, as the landing draws
 * it: the merchant's tile and reference, what was booked or bought, the total,
 * and the card that paid. One shape for every kind of checkout: a purchase
 * lists its items, a table its date, time and party, tickets their seats, a
 * flight its route. Every row is optional, so a free booking shows no total
 * and a receipt with nothing itemised shows only what it has. Sized for the
 * phone: 11-12px text. A card in the theme's own terms: 16px corners, a
 * hairline ring.
 */

export interface ReceiptData {
  kind: ReceiptKind;
  /** Who it is from: "Starbucks", "Nopa". */
  merchant: string;
  /** Its site, for the tile's icon: "opentable.com". */
  host?: string;
  /** The order, confirmation or booking number, as the store gave it. */
  reference?: string;
  /** What it is, when the items do not say: "Dinner for 2", "2 tickets to Coldplay". */
  title?: string;
  /** Facts about it, in order: Date, Time, Party of, Seats, Pickup, Delivery. */
  details?: Array<{ label: string; value: string }>;
  /** What was bought, each with its amount when the store showed one. */
  items?: Array<{ label: string; amount?: string }>;
  /** The total, formatted: "$6.80". None for a booking that cost nothing. */
  total?: string;
  /** What the total row says. Default "Paid". */
  totalLabel?: string;
  /** The card that paid: its label, and its artwork when there is a method to draw. */
  card?: { label: string; paymentMethod?: PaymentMethod };
  /** The last word on it. Default "Approved" when a card paid, else "Confirmed". */
  status?: string;
}

/** What the reference is called, by the kind of checkout. */
const REFERENCE: Record<ReceiptKind, string> = {
  purchase: "Order",
  food: "Order",
  reservation: "Confirmation",
  tickets: "Booking",
  travel: "Booking",
  other: "Reference",
};

/** The tile's icon when there is no site to show. */
const KIND_ICON: Record<ReceiptKind, LucideIcon> = {
  purchase: ShoppingBag,
  food: UtensilsCrossed,
  reservation: CalendarCheck,
  tickets: Ticket,
  travel: Plane,
  other: ReceiptText,
};

export function Receipt({
  receipt,
  mark,
  className,
}: {
  receipt: ReceiptData;
  /** The merchant's own tile, in place of its site's icon. */
  mark?: ReactNode;
  className?: string;
}) {
  const { kind, details, items, total, card } = receipt;
  const status = receipt.status ?? (card ? "Approved" : "Confirmed");
  const title = receipt.title && receipt.title !== receipt.merchant ? receipt.title : undefined;
  const body = Boolean(title || details?.length || items?.length);
  const Icon = KIND_ICON[kind];

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl bg-card px-3 py-2.5 text-left text-[11.5px] leading-tight text-card-foreground ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {mark ?? (
          <span
            aria-hidden
            className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted"
          >
            {receipt.host ? (
              <SiteIcon host={receipt.host} size={16} />
            ) : (
              <Icon className="size-[14px] text-muted-foreground" strokeWidth={2} />
            )}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-px">
          <span className="truncate text-[12px] font-semibold">{receipt.merchant}</span>
          {receipt.reference ? (
            <span className="truncate text-[10.5px] text-muted-foreground">
              {REFERENCE[kind]} #{receipt.reference.replace(/^#/, "")}
            </span>
          ) : null}
        </div>
      </div>

      {body ? (
        <>
          <hr className="border-t border-border" />
          <div className="flex flex-col gap-1">
            {title ? <span className="font-medium">{title}</span> : null}
            {details?.map((d) => (
              <div key={d.label} className="flex items-baseline justify-between gap-3">
                <span className="shrink-0 text-muted-foreground">{d.label}</span>
                <span className="min-w-0 truncate text-right">{d.value}</span>
              </div>
            ))}
            {items?.map((l, i) => (
              <div key={`${l.label}-${i}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{l.label}</span>
                {l.amount ? <span className="shrink-0 tabular-nums">{l.amount}</span> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <hr className="border-t border-border" />
      {total ? (
        <div className="flex items-baseline justify-between gap-3 text-[12px] font-semibold">
          <span>{receipt.totalLabel ?? "Paid"}</span>
          <span className="font-display tabular-nums">{total}</span>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 text-[11px]">
        {card ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {card.paymentMethod ? (
              <CardMark paymentMethod={card.paymentMethod} className="w-[21px]" />
            ) : (
              <CreditCard className="size-[13px] shrink-0 text-muted-foreground" strokeWidth={2} />
            )}
            <span className="truncate">{card.label}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-muted-foreground">{status}</span>
      </div>
    </div>
  );
}
