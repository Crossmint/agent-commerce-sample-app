"use client";

import { cn } from "@/lib/cn";
import { AgentAppRun, type AppRunScript } from "./agent-app-run";
import {
  askEntry,
  CHECKOUT_RUN,
  doneEntry,
  grantedEntry,
  lookedAtCardsEntry,
  orderingEntry,
  progressEntry,
  receiptEntry,
  replyEntry,
  requestEntry,
} from "./agent-app-story";
import { LandingPhone } from "./landing-phone";
import { STORY } from "./story";
import { useStepLoop } from "./use-step-loop";

/*
 * The hero phone: the agent app's own mobile screen, playing the whole story
 * from the ask to the receipt, and never more than one window.
 *
 * The screen is the one from `components/experiences/mobile-app.tsx` — the app
 * a visitor gets from "Try it live" — so the hero shows the product rather
 * than an impression of it. `AgentAppRun` holds the how; this file is only
 * the script.
 */

/** When each entry lands, ms from the start of a run. */
const AT = {
  ask: 300,
  lookedAtCards: 1100,
  reply: 1700,
  request: 2300,
  granted: 6950,
  ordering: 7500,
  progress: 8050,
  done: 11600,
  receipt: 12150,
} as const;

/** The sheet, on the run clock. */
const SHEET = {
  up: 3400,
  down: 6600,
  ready: 3900,
  press: 4700,
  approved: 5250,
} as const;

/** The run restarts here, a beat after the receipt has settled. */
const LOOP = 15400;

const SCRIPT: AppRunScript = {
  thread: [
    { at: AT.ask, entry: askEntry() },
    { at: AT.lookedAtCards, entry: lookedAtCardsEntry() },
    { at: AT.reply, entry: replyEntry() },
    {
      at: AT.request,
      entry: requestEntry({
        // Review presses itself, which calls the sheet up.
        reviewPress: SHEET.up - AT.request - 350,
        settleAt: SHEET.approved - AT.request,
      }),
    },
    { at: AT.granted, entry: grantedEntry() },
    { at: AT.ordering, entry: orderingEntry() },
    { at: AT.progress, entry: progressEntry() },
    { at: AT.done, entry: doneEntry() },
    { at: AT.receipt, entry: receiptEntry() },
  ],
  sheet: SHEET,
};

// The last checkout step has to land before the agent says it is done.
if (process.env.NODE_ENV !== "production" && AT.progress + CHECKOUT_RUN > AT.done) {
  console.warn("[story-phone] the checkout run outlasts the 'done' message");
}

const LABEL = `An iPhone running the agent app: the user asks ${STORY.agent} to ${STORY.ask.toLowerCase()}, the agent asks for a ${STORY.amount} budget, an approval sheet slides up over the chat with the purpose, the limit and the card, the user allows it, the order runs at ${STORY.domain} and a receipt for ${STORY.receipt.total} arrives in the thread`;

/** The hero phone. It plays while in view and starts over each time it comes back. */
export function StoryPhone({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: LOOP });
  return (
    <div ref={ref} className={cn("flex", className)}>
      <LandingPhone label={LABEL}>
        <AgentAppRun script={SCRIPT} run={cycle} />
      </LandingPhone>
    </div>
  );
}
