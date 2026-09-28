import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";
import type { PaymentMethod } from "@agent-commerce/core";
import { CardMark } from "@agent-commerce/ui";
import { cn } from "@/lib/cn";

/*
 * Pieces the mock screens share. Timings are ms from the moment a screen
 * mounts; the phones remount a screen when it becomes active, so every run
 * starts from zero and a single remount replays it.
 */

/** The `--delay` custom property the landing.css animations read. */
export const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/** Text that types in one character at a time from `at`. */
export function Typed({ text, at, speed = 60, className }: { text: string; at: number; speed?: number; className?: string }) {
  return (
    <span className={cn("whitespace-pre", className)} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden className="landing-type" style={delay(at + i * speed)}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** How long `text` takes to type at `speed`. */
export const typedFor = (text: string, speed: number) => text.length * speed;

/**
 * A decorative button. `press` is when it gets pressed; `ready` makes it
 * pulse a ring in the primary color from then until it is pressed. Not a
 * real control: a picture.
 */
export function FauxButton({ children, press, ready, className }: { children: ReactNode; press?: number; ready?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 items-center justify-center rounded-2xl bg-primary text-[14px] font-semibold text-primary-foreground select-none",
        press !== undefined && "landing-press",
        ready !== undefined && "landing-ready",
        className,
      )}
      style={press !== undefined ? delay(press) : ready !== undefined ? delay(ready) : undefined}
    >
      {children}
    </span>
  );
}

/** A check that draws itself inside a primary disc that pops in at `at`. */
export function CheckBurst({ at = 0, size = 56, className }: { at?: number; size?: number; className?: string }) {
  return (
    <span className={cn("landing-pop inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground", className)} style={{ ...delay(at), width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path className="landing-draw" style={delay(at + 180)} d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/** The story's saved cards as Crossmint sends them: the network's own artwork on `display.imageUrl`. */
const CARD_ART: Record<"mastercard" | "visa", PaymentMethod> = {
  mastercard: {
    paymentMethodId: "pm_story_mastercard",
    type: "card",
    card: { brand: "mastercard", last4: "4444" },
    display: { imageUrl: "https://www.crossmint.com/assets/cards/mastercard.svg" },
  } as PaymentMethod,
  visa: {
    paymentMethodId: "pm_story_visa",
    type: "card",
    card: { brand: "visa", last4: "4242" },
    display: { imageUrl: "https://www.crossmint.com/assets/cards/visa.svg" },
  } as PaymentMethod,
};

/**
 * A saved card's mark, drawn by the app's own `CardMark` with the artwork
 * Crossmint sends, so every card on the page (the approval, the saved cards,
 * the budget in the thread) wears the same one. `className` sizes the mark;
 * `at` pops it in.
 */
export function CardBadge({
  network = "mastercard",
  at,
  className,
}: {
  network?: "mastercard" | "visa";
  at?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0", at !== undefined && "landing-pop")}
      style={at !== undefined ? delay(at) : undefined}
    >
      <CardMark paymentMethod={CARD_ART[network]} className={className} />
    </span>
  );
}

/**
 * One step in a run. A hollow dot until `from`, a spinner from `from` to
 * `at`, a check from `at`. The label brightens at `at`.
 */
/**
 * One checkout step, drawn as the app's `CheckoutSteps` draws it at the
 * landing phone's scale: it arrives at `from` with a spinner, and ticks off
 * at `at`, when its label turns from muted to full.
 */
export function RunStep({ label, from, at }: { label: string; from: number; at: number }) {
  return (
    <span className="flex items-start gap-2 leading-snug text-foreground">
      <RunMark from={from} at={at} className="mt-px" />
      <span className="landing-bright min-w-0 flex-1 break-words" style={delay(at)}>
        {label}
      </span>
    </span>
  );
}

/** The app's step mark at the landing's scale (18px there, 15px here): a spinner from `from`, then a tick at `at`. */
export function RunMark({ from, at, size = "size-[15px]", className }: { from: number; at: number; size?: string; className?: string }) {
  const dur = Math.max(at - from, 1);
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", size, className)}>
      <Layer className="landing-window" style={{ ...delay(from), "--dur": `${dur}ms` } as CSSProperties}>
        <Spinner />
      </Layer>
      <Layer className="landing-pop" style={delay(at)}>
        <span className="inline-flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-[70%]" strokeWidth={3.5} />
        </span>
      </Layer>
    </span>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-full animate-spin text-primary" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function Layer({ className, style, children }: { className: string; style: CSSProperties; children: ReactNode }) {
  return (
    <span className={cn("absolute inset-0 inline-flex items-center justify-center", className)} style={style}>
      {children}
    </span>
  );
}
