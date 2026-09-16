import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon, ChevronsUpDownIcon, CreditCardIcon } from "./chat/icons";

/*
 * Pieces shared by the four brands' approval pages. Timings are ms from the
 * moment the page mounts; the story phone remounts a page when it becomes
 * the active screen, so every run starts from zero.
 */

/** Approval page moments. */
export const APPROVE_T = {
  /** The empty "Select credit card" control presses (empty state). */
  addPress: 1400,
  /** Allow starts to pulse (card state). */
  allowReady: 250,
  /** Allow presses (card state). */
  allowPress: 1550,
  /** The check draws (approved state). */
  check: 120,
  /** The success copy fades in (approved state). */
  copy: 480,
} as const;

/** Card entry moments. Digits type at ~72ms each: the number takes ~1.4s. */
export const CARD_T = {
  number: 200,
  numberSpeed: 72,
  brand: 1650,
  expiry: 1760,
  cvc: 2120,
  name: 2380,
  nameSpeed: 48,
  zip: 2960,
  save: 3320,
} as const;

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
 * A check that draws itself inside a disc that pops in. `fill` is the disc
 * color (a color or a gradient), `color` the stroke.
 */
export function CheckBurst({ at = APPROVE_T.check, size = 56, fill, color = "#fff", className }: { at?: number; size?: number; fill: string; color?: string; className?: string }) {
  return (
    <span className={cn("landing-pop inline-flex shrink-0 items-center justify-center rounded-full", className)} style={{ ...delay(at), width: size, height: size, background: fill, color }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path className="landing-draw" style={delay(at + 180)} d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/** A small card brand mark. Visa's blue wordmark on white. */
export function VisaMark({ className, at }: { className?: string; at?: number }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex h-[18px] w-[28px] shrink-0 items-center justify-center rounded-[3px] border border-black/10 bg-white text-[9px] font-black tracking-tight text-[#1a1f71] italic", at !== undefined && "landing-pop", className)}
      style={at !== undefined ? delay(at) : undefined}
    >
      VISA
    </span>
  );
}

/** A tiny "added" tag next to the card label. */
export function AddedTag({ color, className }: { color: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold", className)} style={{ color }}>
      <CheckIcon width={9} height={9} strokeWidth={3.5} />
      added
    </span>
  );
}

/**
 * A decorative button. `press` is when it gets pressed; `ready` makes it
 * pulse a ring in `ringColor` until then. Not a real control: a picture.
 */
export function FauxButton({
  children,
  press,
  ready,
  ringColor,
  disabled = false,
  className,
  style,
}: {
  children: ReactNode;
  press?: number;
  ready?: boolean;
  ringColor?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn("flex items-center justify-center font-semibold select-none", press !== undefined && "landing-press", ready && "landing-ready", disabled && "opacity-40", className)}
      style={{ ...(press !== undefined ? delay(press) : {}), ...(ringColor ? ({ "--ring-color": ringColor } as CSSProperties) : {}), ...style }}
    >
      {children}
    </span>
  );
}

/**
 * The card picker with no card saved yet, drawn as a select: a card outline,
 * "Select credit card", and an up/down chevron pair. Pressing it at `press`
 * moves the story to the card form. `radius` follows the brand's fields.
 */
export function CardSelect({
  press = APPROVE_T.addPress,
  radius,
  background,
  border,
  color,
  iconColor,
  className,
}: {
  press?: number;
  radius: number;
  background: string;
  border: string;
  color: string;
  iconColor?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("landing-press flex h-10 w-full items-center gap-2.5 border px-3 text-[12px] font-medium select-none", className)}
      style={{ ...delay(press), borderRadius: radius, background, borderColor: border, color }}
    >
      <CreditCardIcon width={17} height={17} strokeWidth={1.8} className="shrink-0" style={{ color: iconColor ?? color }} />
      <span className="min-w-0 flex-1 truncate">Select credit card</span>
      <ChevronsUpDownIcon width={15} height={15} strokeWidth={2} className="shrink-0" style={{ color: iconColor ?? color }} />
    </span>
  );
}
