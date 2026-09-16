"use client";

import { cn } from "@/lib/cn";
import { StepDots } from "./step-ui";
import { phaseOf, STORY_DURATIONS, STORY_PHASES, STORY_REDUCED, STORY_STEPS, StoryPhone } from "./story-phone";
import { useStepLoop } from "./use-step-loop";

const DOMAIN = "yourplatform.com";

const CAPTIONS = ["The user asks. The agent sends an approval link.", `The user adds a card and approves once, on ${DOMAIN}.`, "The agent has $8 on the user's card."];

/**
 * The Agent Cards experience: one phone that plays the story, three dots for
 * its three phases, and a caption for the current one.
 */
export function AgentCardsDemo({ className }: { className?: string }) {
  const { ref, step, cycle, jump } = useStepLoop<HTMLDivElement>(STORY_STEPS, { durations: STORY_DURATIONS, hold: 1200, reducedSteps: STORY_REDUCED });
  const phase = phaseOf(step);
  return (
    <div ref={ref} className={cn("relative flex flex-col gap-5", className)}>
      <div aria-hidden className="landing-glow absolute -inset-10 -z-10" />
      <StoryPhone step={step} cycle={cycle} />
      <div className="flex flex-col items-start gap-2">
        <StepDots count={3} active={phase} onPick={(i) => jump(STORY_PHASES[i]?.start ?? 0)} labels={CAPTIONS} />
        <p className="min-h-[1.5em] text-sm text-muted-foreground" aria-live="polite">
          {CAPTIONS[phase]}
        </p>
      </div>
    </div>
  );
}
