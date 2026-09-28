"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@agent-commerce/ui";
import { CardBadge, delay, FauxButton, RunStep } from "./bits";
import { ReceiptCard, StarbucksMark } from "./receipt-card";
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
  text: <>I can do that. I need a {STORY.amount} budget on your card for this.</>,
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
 * The budget request in the thread, drawn as the app's `ApprovalInThread`
 * draws it at the landing phone's scale: the agent asks in its bubble, and
 * the request sits under it as one card, what it is for with Pending, the
 * limit and the store, then Review. With `settleAt`, the same card settles
 * in place: Pending turns to Approved, the card behind it appears, and
 * Review folds away. Settled at 0, it is there already settled; without
 * `settleAt` it stays on Review.
 */
export function ApprovalThreadCard({
  settleAt,
  reviewPress,
}: {
  settleAt?: number;
  reviewPress?: number;
}) {
  const settled = settleAt === 0;
  const settles = settleAt !== undefined && settleAt > 0;
  const at = settles ? delay(settleAt) : undefined;
  const badge = "px-1.5 py-px text-[10px]";
  return (
    <div className="flex flex-col gap-2">
      <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-[7px] text-[12.5px] leading-snug text-foreground">
        Can you approve this request to use your card?
      </p>
      <div className="flex flex-col gap-2.5 rounded-2xl bg-card p-[13px] text-card-foreground ring-1 ring-foreground/10">
        <div className="flex items-start justify-between gap-2.5">
          <p className="min-w-0 text-[11.5px] leading-snug font-medium text-balance">
            {STORY.purpose}
          </p>
          {/* Both badges share one cell, so the swap does not move the title. */}
          <span className="grid shrink-0 justify-items-end">
            {settled ? null : (
              <Badge
                variant="muted"
                className={`${badge} [grid-area:1/1] ${settles ? "landing-vanish" : ""}`}
                style={at}
              >
                Pending
              </Badge>
            )}
            {settled || settles ? (
              <Badge
                variant="success"
                className={`${badge} [grid-area:1/1] ${settles ? "landing-pop" : ""}`}
                style={at}
              >
                Approved
              </Badge>
            ) : null}
          </span>
        </div>
        <dl className="flex flex-col gap-1.5 text-[11.5px]">
          <Fact label="Limit">
            <span className="font-medium tabular-nums">{STORY.amount}</span>
          </Fact>
          {settled || settles ? (
            <div className={settles ? "landing-grow" : undefined} style={at}>
              <div>
                <Fact label="Card">
                  <span className="flex min-w-0 items-center justify-end gap-1.5">
                    <CardBadge className="w-[30px]" />
                    <span className="truncate">{STORY.card}</span>
                  </span>
                </Fact>
              </div>
            </div>
          ) : null}
          <Fact label="Store">{STORY.merchant}</Fact>
        </dl>
        {settled ? null : (
          <div className={settles ? "landing-shrink" : undefined} style={at}>
            <div>
              <FauxButton press={reviewPress} className="h-[46px] rounded-[13px] text-[13px]">
                Review
              </FauxButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** One line of the request card: the name on the left, the value on the right. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
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

/**
 * How much faster the story runs than a real checkout, for the card's clock:
 * five steps land in three seconds here, and a real run takes most of a minute.
 */
const CLOCK_SPEEDUP = 12;

/**
 * The checkout running, drawn as the app's `CheckoutRunCard` draws it at the
 * landing phone's scale, opened to all its steps: the store's icon, the task
 * and the store, how long it has taken, then each step as it lands, ticking
 * off as the next one starts.
 */
export function ProgressCard({ from, steps }: { from: number; steps: number[] }) {
  const last = steps[steps.length - 1] ?? from;
  return (
    <div className="flex w-full flex-col gap-2.5 rounded-2xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10">
      <div className="flex items-start gap-2">
        <StarbucksMark size={18} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[11.5px] font-medium">{STORY.action}</span>
          <span className="truncate text-[9px] text-muted-foreground">{STORY.domain}</span>
        </span>
        <RunClock
          from={from}
          until={last}
          className="mt-0.5 shrink-0 text-[9px] leading-[13px] text-muted-foreground"
        />
        <ChevronDown
          aria-hidden
          className="mt-0.5 size-[13px] shrink-0 rotate-180 text-muted-foreground"
        />
      </div>
      <div className="flex flex-col text-[11.5px]">
        {STORY.checkoutSteps.map((label, i) => {
          const start = i === 0 ? from : (steps[i - 1] ?? from);
          return (
            <div key={label} className="landing-grow" style={delay(start)}>
              <div className={i === 0 ? undefined : "pt-2"}>
                <RunStep label={label} from={start} at={steps[i] ?? last} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The card's clock: seconds since the run started, sped up to a real run's pace, stopping when it ends. */
function RunClock({ from, until, className }: { from: number; until: number; className?: string }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const mounted = Date.now();
    const t = setInterval(() => {
      const run = Math.min(Math.max(Date.now() - mounted - from, 0), until - from);
      setMs(run);
      if (run >= until - from) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [from, until]);
  const secs = Math.round((ms * CLOCK_SPEEDUP) / 1000);
  return <span className={`tabular-nums ${className ?? ""}`}>{secs}s</span>;
}
