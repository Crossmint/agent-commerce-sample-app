"use client";

import { STORY_DURATIONS, STORY_STEPS, StoryPhone } from "./story-phone";
import { useStepLoop } from "./use-step-loop";

/**
 * The hero phone. It plays the whole story on a loop: the iMessage ask, the
 * approval on yourplatform.com with the card added, and the thread again
 * with the approval, "Ordered", and the receipt. It rests on the final
 * thread for 3s before it loops, pauses out of view, and under reduced
 * motion shows the final thread only.
 */
export function HeroPhone({ className }: { className?: string }) {
  const { ref, step, cycle } = useStepLoop<HTMLDivElement>(STORY_STEPS, { durations: STORY_DURATIONS, hold: 3000, reducedSteps: [STORY_STEPS - 1] });
  return (
    <div ref={ref} className={className}>
      <div aria-hidden className="landing-glow absolute -inset-16 -z-10" />
      <StoryPhone step={step} cycle={cycle} className="shadow-2xl" />
    </div>
  );
}
