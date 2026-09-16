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

export function SectionHeading({ title, sub, align = "center" }: { title: string; sub?: ReactNode; align?: "center" | "left" }) {
  return (
    <Reveal className={cn("mb-12 flex flex-col gap-3 sm:mb-16", align === "center" ? "items-center text-center" : "items-start")}>
      <h2 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{title}</h2>
      {sub ? <p className="max-w-2xl text-lg text-muted-foreground text-balance sm:text-xl">{sub}</p> : null}
    </Reveal>
  );
}
