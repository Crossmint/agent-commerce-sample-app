"use client";

import { useState } from "react";
import { APPROVE_SCREEN_BG, ApproveScreen, CardEntryPage } from "./approve-screen-mock";
import { type Brand, DEFAULT_BRAND } from "./brands";
import { CHAT_APP_NAME, CHAT_SCREEN_BG, CHAT_TONE } from "./chat";
import { MessageThreadScreen } from "./message-thread-mock";
import { PhoneFrame } from "./phone-frame";
import { ScreenStack } from "./step-ui";

/*
 * The whole story in one phone, six screens:
 * 0. The thread. The user asks, the agent asks for $8 and sends the link.
 * 1. The approval page with no card yet: the "Select credit card" control, pressed.
 * 2. The card entry form. The digits type in, the Visa mark appears.
 * 3. The approval page with the card added. Allow lights up and is pressed.
 * 4. Approved. The check draws.
 * 5. The thread again: "You approved $8.00", "Ordered", the receipt.
 */
export const STORY_STEPS = 6;

/** ms per screen. The form is longer: ~1.5s of typing plus the other fields and the Save press. */
export const STORY_DURATIONS = [3000, 2100, 4000, 2300, 2000, 3200];

/** Under reduced motion only the approval page with the card and the final thread show. */
export const STORY_REDUCED = [3, 5];

/** The three phases of the story, for dots and captions: ask, approve, receipt. */
export const STORY_PHASES = [
  { start: 0, label: "The user asks." },
  { start: 1, label: "The user adds a card and approves once, on your domain." },
  { start: 5, label: "The agent pays and sends the receipt." },
] as const;

/** Which phase a step belongs to. */
export const phaseOf = (step: number) => (step === 0 ? 0 : step >= 5 ? 2 : 1);

export interface StoryPhoneProps {
  brand?: Brand;
  /** The active screen, 0..5. */
  step: number;
  /** Loop counter from `useStepLoop`. Bumps replay the first screen. */
  cycle: number;
  className?: string;
  label?: string;
}

/**
 * One phone that plays the story. Screens crossfade through `ScreenStack`.
 * Each screen's content remounts when it becomes active, so its CSS
 * animations (bubbles, typing, the check) start from zero every time.
 */
export function StoryPhone({ brand = DEFAULT_BRAND, step, cycle, className, label }: StoryPhoneProps) {
  const keys = useActivationKeys(step, cycle, STORY_STEPS);
  const onThread = step === 0 || step === 5;
  const chatTone = CHAT_TONE[brand.chatStyle];
  const thread = { style: brand.chatStyle, agentName: brand.name, logo: brand.id === "goat" ? undefined : brand.logo, logoStyle: brand.logoStyle, domain: brand.domain } as const;
  const app = CHAT_APP_NAME[brand.chatStyle];

  return (
    <PhoneFrame
      className={className}
      statusTone={onThread ? chatTone : brand.tone === "light" ? "dark" : "light"}
      screenClassName={onThread ? CHAT_SCREEN_BG[brand.chatStyle] : APPROVE_SCREEN_BG[brand.tone]}
      label={
        label ??
        `A phone that plays the ${brand.name} flow: the user asks for a latte in ${app}, ${brand.name} asks for $8 and sends a link to ${brand.domain}, the user adds a Visa ending 4242 and approves, and the thread confirms the order with a receipt`
      }
    >
      <ScreenStack active={step}>
        <MessageThreadScreen key={keys[0]} {...thread} variant="request" />
        <ApproveScreen key={keys[1]} brand={brand} state="empty" />
        <CardEntryPage key={keys[2]} brand={brand} />
        <ApproveScreen key={keys[3]} brand={brand} state="card" />
        <ApproveScreen key={keys[4]} brand={brand} state="approved" />
        <MessageThreadScreen key={keys[5]} {...thread} variant="confirmation" />
      </ScreenStack>
    </PhoneFrame>
  );
}

/**
 * A key per screen that changes when that screen becomes active, and never
 * when it leaves. Screen 0 also changes with the loop counter, so the story
 * restarts when the phone scrolls back into view. Uses the React pattern for
 * state derived from the previous render.
 */
function useActivationKeys(step: number, cycle: number, count: number): string[] {
  const [keys, setKeys] = useState<number[]>(() => Array.from({ length: count }, () => 0));
  const [prev, setPrev] = useState({ step, cycle });
  if (prev.step !== step || prev.cycle !== cycle) {
    setPrev({ step, cycle });
    setKeys((k) => k.map((n, i) => (i === step ? n + 1 : n)));
  }
  return keys.map((n, i) => (i === 0 ? `${cycle}-${n}` : `${n}`));
}
