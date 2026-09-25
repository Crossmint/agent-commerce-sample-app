import Image from "next/image";
import { Receipt } from "@/components/receipt";
import { STORY } from "./story";

/*
 * The order receipt the agent sends after a checkout, drawn by the same
 * receipt the chat sends: merchant tile and order number, the line items, the
 * total, and the card that paid.
 *
 * The merchant tile carries Starbucks' siren in white on Starbucks green,
 * the one place on the page that wears a real merchant's mark: a receipt with
 * a letter tile on it does not read as a receipt.
 */

/** Starbucks green, from the brand's own palette. */
const STARBUCKS_GREEN = "#00704A";

export function ReceiptCard({ className }: { className?: string }) {
  return (
    <Receipt
      className={className}
      receipt={{
        kind: "food",
        merchant: STORY.merchant,
        reference: STORY.order,
        items: [...STORY.receipt.lines],
        total: STORY.receipt.total,
        card: { label: STORY.card },
      }}
      mark={<StarbucksMark size={26} />}
    />
  );
}

/** Starbucks' siren in white on Starbucks green, round. The receipt's tile; the checkout card wears it too. */
export function StarbucksMark({ size }: { size: number }) {
  const siren = Math.round(size * 0.7);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: STARBUCKS_GREEN, width: size, height: size }}
    >
      <Image
        src="/logos/starbucks.svg"
        alt=""
        width={siren}
        height={siren}
        style={{ width: siren, height: siren }}
      />
    </span>
  );
}
