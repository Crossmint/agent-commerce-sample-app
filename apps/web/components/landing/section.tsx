import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./reveal";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

/** A plain section on the canvas. Spacing separates it from its neighbors; there are no rules. */
export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-16 sm:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** A section title with an optional line under it. Left-aligned, like all landing copy. */
export function SectionHeading({ title, sub, className }: { title: string; sub?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn("mb-10 flex flex-col items-start gap-3 sm:mb-14", className)}>
      <h2 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-foreground sm:text-[36px]">{title}</h2>
      {sub ? <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{sub}</p> : null}
    </Reveal>
  );
}
