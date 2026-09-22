import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
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

/**
 * The saved card row's mark: the network's own artwork, the same files the
 * real `CardMark` shows when Crossmint sends `display.imageUrl`. The files are
 * 780x500, so the 36x24 box keeps their proportions exactly.
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
    <Image
      aria-hidden
      alt=""
      src={`/icons/payments/${network}.svg`}
      width={36}
      height={24}
      className={cn(
        "h-6 w-9 shrink-0 rounded-[3px] object-cover",
        at !== undefined && "landing-pop",
        className,
      )}
      style={at !== undefined ? delay(at) : undefined}
    />
  );
}

/**
 * One step in a run. A hollow dot until `from`, a spinner from `from` to
 * `at`, a check from `at`. The label brightens at `at`.
 */
export function RunStep({ label, from, at }: { label: string; from: number; at: number }) {
  return (
    <span className="flex items-start gap-2 leading-tight text-foreground">
      <RunMark from={from} at={at} />
      <span className="landing-bright min-w-0 truncate" style={delay(at)}>
        {label}
      </span>
    </span>
  );
}

export function RunMark({ from, at, size = "size-4", className }: { from: number; at: number; size?: string; className?: string }) {
  const dur = Math.max(at - from, 1);
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", size, className)}>
      <Layer className="landing-vanish" style={delay(from)}>
        <span className="block size-[9px] rounded-full border-[1.5px] border-current opacity-40" />
      </Layer>
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
