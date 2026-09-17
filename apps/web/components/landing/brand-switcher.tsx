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
  /** Title and copy for the left column. */
  intro: ReactNode;
  /** Call to action under the intro. */
  cta?: ReactNode;
}

/**
 * One two-column block. Left, the intro and the call to action. Right, an
 * "Example platforms" label, the brand pills, one phone that plays the whole
 * story for the selected brand, and the step dots, all centered on the
 * phone; on desktop that stack hugs the right edge, like the hero phone. A
 * brand switch restarts the story. On small screens the columns stack.
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
    <div ref={ref} className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className="flex flex-col items-start gap-8">
        {intro}
        {cta}
      </div>

      <div className="mx-auto flex w-fit max-w-full flex-col items-center gap-5 lg:mr-0">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Example platforms</p>
        <div role="tablist" aria-label="Example platform" className="flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-md border border-border bg-card p-1">
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
        <StoryPhone key={brand.id} brand={brand} step={step} cycle={cycle} />
        <StepDots count={3} active={phase} onPick={(i) => jump(STORY_PHASES[i]?.start ?? 0)} labels={LABELS} className="ml-0" />
      </div>
    </div>
  );
}
