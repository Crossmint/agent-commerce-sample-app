"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Sheets that stay inside the phone screen.
 *
 * Neither is a Radix or vaul dialog on purpose. Those are modal: they set
 * `pointer-events: none` on the page body, trap focus, and dismiss on any
 * press outside themselves. The card network's verification window (Basis
 * Theory) mounts on the body, outside the phone, so under a modal sheet its
 * buttons could not be pressed and every press closed the sheet under it.
 * Plain elements with a transition give the same look without any of that.
 * Both are positioned inside the screen element they are rendered in, so
 * the scrim and the sheet are clipped by the phone rather than covering the
 * page; on a real phone the screen is the viewport, so it behaves the same.
 */

export const SHEET_TRANSITION_MS = 320;

/**
 * A bottom sheet with a title and a round close button. `container` is kept
 * for callers; the sheet renders where it is placed, inside the screen.
 */
export function PhoneSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  dismissible = true,
  height = "h-[92%]",
  hideTitle = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Unused. The sheet renders in place, inside the phone screen. */
  container?: HTMLElement | null;
  /** The sheet's name. Always the accessible name; shown as a heading unless `hideTitle`. */
  title: string;
  /**
   * Keep the name for assistive tech but not on screen, for a sheet whose
   * contents open with a heading of their own. The close button stays.
   */
  hideTitle?: boolean;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
  /** Tailwind height class for the sheet. Default 92% of the screen. */
  height?: string;
}) {
  const titleId = useId();

  // Escape closes the sheet, unless it must stay.
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible, onOpenChange]);

  return (
    <div className="absolute inset-0 z-50 overflow-hidden" inert={!open || undefined}>
      <div
        aria-hidden
        onClick={dismissible ? () => onOpenChange(false) : undefined}
        className={cn(
          "absolute inset-0 bg-black/10 transition-opacity duration-300 supports-backdrop-filter:backdrop-blur-xs motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[2rem] bg-popover text-popover-foreground shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-out outline-none motion-reduce:transition-none",
          open ? "translate-y-0" : "translate-y-full",
          height,
          className,
        )}
      >
        <div className={cn("flex shrink-0 items-start justify-between p-6", hideTitle ? "pb-0" : "pb-2")}>
          <h2
            id={titleId}
            className={cn("mt-1 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em]", hideTitle && "sr-only")}
          >
            {title}
          </h2>
          <button type="button" onClick={() => onOpenChange(false)} className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <X className="size-4.5" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-8">{children}</div>
      </div>
    </div>
  );
}

/**
 * A full page that slides up over the screen, like the onramp's deposit
 * sheet. Children draw their own header, usually a round back button.
 */
export const PAGE_SHEET_TRANSITION_MS = SHEET_TRANSITION_MS;

export function PhonePageSheet({ open, ariaLabel, children, className }: { open: boolean; ariaLabel: string; children: ReactNode; className?: string }) {
  return (
    <div className="absolute inset-0 z-30 overflow-hidden" inert={!open || undefined}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "absolute inset-0 flex flex-col bg-background transition-transform duration-300 ease-out motion-reduce:transition-none",
          open ? "translate-y-0" : "translate-y-full",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
