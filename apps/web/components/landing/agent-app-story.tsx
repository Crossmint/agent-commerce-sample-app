"use client";

import { Lock } from "lucide-react";
import { delay, FauxButton, RunMark, RunStep } from "./bits";
import { ReceiptCard } from "./receipt-card";
import { Approved, RequestForm } from "./screen-approve";
import type { AppEntry } from "./screen-agent-app";
import { STORY } from "./story";

/*
 * The story as the agent app tells it, in the pieces both phones need: the
 * hero plays the whole run, and `how-it-works` shows the approval and the
 * checkout on their own. One file, so the two never drift apart.
 *
 * Every timing a piece takes is ms from that piece mounting, not from the
 * start of a run: cards mount with their entry, so a caller that lands an
 * entry late passes delays relative to the landing.
 */

/** The five checkout steps, ms from the progress card landing. */
export const CHECKOUT_STEPS = [600, 1200, 1800, 2400, 3000];
/** When the last checkout step lands, ms from the progress card landing. */
export const CHECKOUT_RUN = CHECKOUT_STEPS[CHECKOUT_STEPS.length - 1] ?? 3000;

/* ---------- The entries ---------- */

export const askEntry = (): AppEntry => ({ kind: "user", key: "ask", text: STORY.ask });

export const lookedAtCardsEntry = (): AppEntry => ({
  kind: "activity",
  key: "cards",
  label: "Looked at your saved cards",
});

export const replyEntry = (): AppEntry => ({
  kind: "agent",
  key: "reply",
  text: (
    <>I can do that. I need a {STORY.amount} budget on your card for this — approve it below.</>
  ),
});

export const requestEntry = (opts: { settleAt?: number; reviewPress?: number }): AppEntry => ({
  kind: "card",
  key: "request",
  node: <ApprovalThreadCard {...opts} />,
});

export const grantedEntry = (): AppEntry => ({
  kind: "activity",
  key: "granted",
  label: <>Agent card issued · {STORY.card}</>,
});

export const orderingEntry = (): AppEntry => ({
  kind: "agent",
  key: "ordering",
  text: <>Ordering at {STORY.domain}…</>,
});

export const progressEntry = (): AppEntry => ({
  kind: "card",
  key: "progress",
  node: <ProgressCard from={0} steps={CHECKOUT_STEPS} />,
});

export const doneEntry = (): AppEntry => ({
  kind: "agent",
  key: "done",
  text: (
    <>
      Done. Order #{STORY.order} is ready for pickup at {STORY.merchant}.
    </>
  ),
});

export const receiptEntry = (): AppEntry => ({
  kind: "card",
  key: "receipt",
  node: <ReceiptCard />,
});

/* ---------- The pieces the entries are made of ---------- */

/**
 * The budget request in the thread, as the real app's `ApprovalCard` shows
 * it: the ask in one line, then Review. With `settleAt` the card settles into
 * its outcome in place — same card, new state — rather than a second one
 * landing under it. Without it the card stays on Review.
 */
export function ApprovalThreadCard({
  settleAt,
  reviewPress,
}: {
  settleAt?: number;
  reviewPress?: number;
}) {
  const settles = settleAt !== undefined;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] leading-snug font-medium text-balance">
          {STORY.agent} wants to spend up to{" "}
          <span className="font-display tabular-nums">{STORY.amount}</span> for{" "}
          {STORY.purpose.toLowerCase()}
        </p>
        {settles ? (
          <span
            className="landing-fade inline-flex shrink-0 items-center rounded-full bg-success/10 px-2 py-0.5 text-[9.5px] font-medium text-success"
            style={delay(settleAt)}
          >
            active
          </span>
        ) : null}
      </div>
      <div className="relative">
        <div
          className={settles ? "landing-vanish" : undefined}
          style={settles ? delay(settleAt) : undefined}
        >
          <FauxButton press={reviewPress} className="h-9 w-full rounded-full text-[12px]">
            Review
          </FauxButton>
        </div>
        {settles ? (
          <p
            className="landing-fade absolute inset-x-0 top-0 text-[10.5px] text-muted-foreground"
            style={delay(settleAt + 120)}
          >
            Up to {STORY.amount} at {STORY.merchant} until {STORY.expires}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What the app's Approve sheet holds: the request, then the outcome in its
 * place. Timings are ms from the sheet's contents mounting.
 */
export function ApprovalSheetBody({
  ready,
  press,
  approved,
}: {
  ready: number;
  press: number;
  approved: number;
}) {
  return (
    <div className="relative">
      <div className="landing-vanish flex flex-col gap-3" style={delay(approved)}>
        <RequestForm ready={ready} press={press} />
      </div>
      <div className="absolute inset-x-0 top-0 flex flex-col gap-3">
        <Approved at={approved + 100} />
      </div>
    </div>
  );
}

/* ---------- The checkout card ---------- */

/** The checkout running: the store, then five steps that check off one by one. */
export function ProgressCard({ from, steps }: { from: number; steps: number[] }) {
  const last = steps[steps.length - 1] ?? from;
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-2xl bg-card px-3 py-2.5 text-[11.5px] text-card-foreground ring-1 ring-foreground/10">
      <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="inline-flex items-center gap-1">
          <Lock className="size-2.5" strokeWidth={2.5} />
          {STORY.domain}
        </span>
        <RunMark from={from} at={last} size="size-3" />
      </div>
      {STORY.checkoutSteps.map((label, i) => (
        <RunStep
          key={label}
          label={label}
          from={i === 0 ? from : (steps[i - 1] ?? from)}
          at={steps[i] ?? last}
        />
      ))}
    </div>
  );
}
