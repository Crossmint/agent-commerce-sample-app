"use client";

import { APPROVE_SCREEN_BG, ApproveScreen } from "./approve-screen-mock";
import { CHAT_SCREEN_BG } from "./chat";
import { MessageThreadScreen } from "./message-thread-mock";
import { PhoneFrame } from "./phone-frame";
import { ScreenStack } from "./step-ui";
import { useStepLoop } from "./use-step-loop";

const DOMAIN = "yourplatform.com";

/**
 * The hero phone. One phone that steps through the story: the iMessage
 * thread where the agent asks and sends the link, the approval screen on
 * yourplatform.com, then the thread again with "You approved $8.00". Loops
 * while in view; rests on the final thread under reduced motion.
 */
export function HeroPhone({ className }: { className?: string }) {
  const { ref, step, cycle } = useStepLoop<HTMLDivElement>(3, { interval: 2900, hold: 1100 });
  const onThread = step !== 1;
  return (
    <div ref={ref} className={className}>
      <div aria-hidden className="landing-glow absolute -inset-16 -z-10" />
      <PhoneFrame
        width={300}
        screenClassName={onThread ? CHAT_SCREEN_BG.imessage : APPROVE_SCREEN_BG.dark}
        className="shadow-2xl"
        label="A phone that steps through the flow: the user asks their agent for a latte in iMessage, approves $8 on yourplatform.com, and the thread confirms the approval"
      >
        <ScreenStack active={step}>
          <MessageThreadScreen key={cycle} style="imessage" variant="request" domain={DOMAIN} />
          <ApproveScreen domain={DOMAIN} agentName="Your agent" />
          <MessageThreadScreen key={`${cycle}-approved`} style="imessage" variant="approved" domain={DOMAIN} />
        </ScreenStack>
      </PhoneFrame>
    </div>
  );
}
