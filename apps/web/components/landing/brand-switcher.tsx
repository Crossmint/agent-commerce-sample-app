"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import { type AgentBrand, type BrandId, BRANDS } from "./brands";
import { StepDots } from "./step-ui";
import { phaseOf, STORY_DURATIONS, STORY_PHASES, STORY_REDUCED, STORY_STEPS, StoryPhone } from "./story-phone";
import { useStepLoop } from "./use-step-loop";

const LABELS = STORY_PHASES.map((p) => p.label);

export interface BrandSwitcherProps {
  /** Title and copy for the top of the left column. */
  intro: ReactNode;
  /** Call to action for the bottom of the left column. */
  cta?: ReactNode;
}

/**
 * "Start building today": one two-column block. Left, the intro, the three
 * numbered one-line steps (the current one lit), and the call to action.
 * Right, the brand pills centered over one phone that plays the whole story
 * for the selected brand, with the step dots under it. A brand switch
 * restarts the story. On small screens it stacks: text, then pills, phone,
 * dots, all centered.
 */
export function BrandSwitcher({ intro, cta }: BrandSwitcherProps) {
  const [active, setActive] = useState<BrandId>("impulse");
  const { ref, step, cycle, jump } = useStepLoop<HTMLDivElement>(STORY_STEPS, { durations: STORY_DURATIONS, hold: 1200, reducedSteps: STORY_REDUCED });
  const brand: AgentBrand = BRANDS.find((b) => b.id === active) ?? BRANDS[0]!;
  const phase = phaseOf(step);

  const pick = (id: BrandId) => {
    if (id === active) return;
    setActive(id);
    jump(0);
  };

  return (
    <div ref={ref} className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col items-start gap-8">
        {intro}
        <ol className="flex flex-col gap-2">
          {STORY_PHASES.map((p, i) => (
            <li key={p.label} className="flex">
              <button
                type="button"
                onClick={() => jump(p.start)}
                aria-current={i === phase ? "step" : undefined}
                className={cn(
                  "flex items-baseline gap-3 py-0.5 text-left text-base leading-snug transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:text-lg",
                  i === phase ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("font-mono text-sm font-semibold tabular-nums", i === phase ? "text-primary" : "")}>{i + 1}</span>
                <span>{p.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {cta}
      </div>

      <div className="flex w-full flex-col items-center gap-5">
        <div role="tablist" aria-label="Brand" className="flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-md border border-border bg-background p-1">
          {BRANDS.map((b) => (
            <button
              key={b.id}
              role="tab"
              type="button"
              aria-selected={b.id === active}
              onClick={() => pick(b.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-sm px-3.5 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                b.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Image src={b.logo} alt="" width={16} height={16} className="size-4 shrink-0 rounded-[3px] object-contain" />
              {b.name}
            </button>
          ))}
        </div>
        {/* Keyed on the brand: a switch remounts the phone and the story starts over. */}
        <StoryPhone key={brand.id} brand={brand} step={step} cycle={cycle} className="mx-auto" />
        <StepDots count={3} active={phase} onPick={(i) => jump(STORY_PHASES[i]?.start ?? 0)} labels={LABELS} className="ml-0" />
      </div>
    </div>
  );
}
