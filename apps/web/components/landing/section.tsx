import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Reveal } from "./reveal";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export interface SectionProps {
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Section({ id, className, children }: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-20 sm:py-28", className)}>
      <Container>{children}</Container>
    </section>
  );
}

/** A section title with an optional line under it. Left-aligned, like all landing copy. */
export function SectionHeading({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <Reveal className="mb-12 flex flex-col items-start gap-3 sm:mb-16">
      <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      {sub ? <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">{sub}</p> : null}
    </Reveal>
  );
}
