"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useInView } from "./use-in-view";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in ms before the element rises in. */
  delay?: number;
}

/**
 * Fades and slides its children in when they scroll into view. Content that
 * is visible on first paint is never hidden, so the page reads without JS.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ once: true, threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  const state = inView === null ? "idle" : inView ? "shown" : "hidden";
  return (
    <div
      ref={ref}
      data-reveal={state}
      className={cn("landing-reveal", className)}
      style={{ "--delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
