"use client";

import { cn } from "@/lib/cn";
import { InstagramScreen } from "../chat/instagram";
import { LandingPhone } from "../landing-phone";
import { useStepLoop } from "../use-step-loop";
import { MESSAGING_T, messagingLabel, messagingThread } from "./messaging-thread";

/** The shared messaging story over Instagram Direct. */
export function InstagramMock({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: MESSAGING_T.loop });
  return (
    <div ref={ref} className={cn("flex justify-center", className)}>
      <LandingPhone label={messagingLabel("Instagram")}>
        <InstagramScreen key={cycle} messages={messagingThread()} />
      </LandingPhone>
    </div>
  );
}
