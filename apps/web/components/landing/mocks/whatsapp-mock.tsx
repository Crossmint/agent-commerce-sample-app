"use client";

import { cn } from "@/lib/cn";
import { WhatsAppScreen } from "../chat/whatsapp";
import { LandingPhone } from "../landing-phone";
import { useStepLoop } from "../use-step-loop";
import { MESSAGING_T, messagingLabel, messagingThread } from "./messaging-thread";

/** The shared messaging story over WhatsApp. */
export function WhatsAppMock({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: MESSAGING_T.loop });
  return (
    <div ref={ref} className={cn("flex justify-center", className)}>
      <LandingPhone label={messagingLabel("WhatsApp")}>
        <WhatsAppScreen key={cycle} messages={messagingThread()} />
      </LandingPhone>
    </div>
  );
}
