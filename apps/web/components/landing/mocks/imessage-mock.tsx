"use client";

import { cn } from "@/lib/cn";
import { IMessageScreen } from "../chat/imessage";
import { LandingPhone } from "../landing-phone";
import { useStepLoop } from "../use-step-loop";
import { MESSAGING_T, messagingLabel, messagingThread } from "./messaging-thread";

/** The shared messaging story over iMessage. */
export function IMessageMock({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: MESSAGING_T.loop });
  return (
    <div ref={ref} className={cn("flex justify-center", className)}>
      <LandingPhone label={messagingLabel("iMessage")}>
        <IMessageScreen key={cycle} messages={messagingThread()} />
      </LandingPhone>
    </div>
  );
}
