"use client";

import type { ReactNode } from "react";
import { ChevronsUpDown, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { CardBadge, CheckBurst, delay, FauxButton } from "./bits";
import { AgentChatScreen, requestThread } from "./screen-chat";
import { STORY } from "./story";

/*
 * The approval sheet over the chat, the screen your platform hosts. Same
 * bones as the real `ApproveAgentCard`: headline, Purpose and Limit, the
 * card picker, one reassurance line, Allow. Timings are ms from mount.
 * Tokens only, so a `data-brand` wrapper re-themes the whole sheet.
 *
 * - request: the chat is settled; the sheet slides up, Allow pulses, then presses.
 * - approved: the sheet is already up and shows the Approved state.
 * - full: the chat plays (ask, reply, request card), the card's button
 *   presses itself, the sheet slides up, Allow presses, Approved shows.
 */
export type ApproveState = "request" | "approved" | "full";

export const APPROVE_T = {
  sheet: 150,
  ready: 800,
  press: 1900,
} as const;

/** The "full" run, from the first bubble to Approved. */
export const APPROVE_FULL_T = {
  chat: { ask: 200, reply: 900, request: 1500 },
  /** The request card's button presses itself. */
  cardPress: 2300,
  sheet: 2600,
  ready: 3200,
  press: 4200,
  approvedAt: 4800,
} as const;
/** When the "full" run has shown Approved for a moment, ms from mount. */
export const APPROVE_FULL_END = APPROVE_FULL_T.approvedAt + 1900;

export function ApproveScreen({ state }: { state: ApproveState }) {
  const full = state === "full";
  // A negative delay finishes the slide before the first frame: the sheet
  // was already up on the screen before this one.
  const sheetAt = state === "approved" ? -1000 : full ? APPROVE_FULL_T.sheet : APPROVE_T.sheet;
  const showForm = state !== "approved";
  const showDone = state !== "request";
  const switchAt = full ? APPROVE_FULL_T.approvedAt : 0;
  const messages = full
    ? requestThread({ pressAt: APPROVE_FULL_T.cardPress, times: APPROVE_FULL_T.chat })
    : requestThread({ settled: true });
  return (
    <div className="relative h-full">
      <AgentChatScreen messages={messages} />
      <div
        aria-hidden
        className="landing-scrim absolute inset-0 z-30 bg-black/10"
        style={delay(sheetAt)}
      />
      <div
        className="landing-sheet absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[calc(var(--radius)+18px)] bg-background px-5 pt-3 pb-7 text-foreground"
        style={delay(sheetAt)}
      >
        <span aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted-strong" />
        <div className="relative">
          {showForm ? (
            <div
              className={cn("flex flex-col gap-3", full && "landing-vanish")}
              style={full ? delay(switchAt) : undefined}
            >
              <RequestForm
                ready={full ? APPROVE_FULL_T.ready : APPROVE_T.ready}
                press={full ? APPROVE_FULL_T.press : APPROVE_T.press}
              />
            </div>
          ) : null}
          {showDone ? (
            <div className={cn("flex flex-col gap-3", full && "absolute inset-x-0 top-0")}>
              <Approved at={state === "approved" ? 150 : switchAt + 100} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The sheet body before approval: the request, the figures, the card, Allow. */
export function RequestForm({ ready, press }: { ready: number; press: number }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-[17px] leading-[1.2] font-semibold tracking-[-0.02em]">
          {STORY.agent} is requesting to use your card
        </p>
        <p className="text-[11.5px] text-muted-foreground">
          Approve it once, for this budget only.
        </p>
      </div>
      <dl className="flex flex-col divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
        <Row label="Purpose">{STORY.purpose}</Row>
        <Row label="Limit">
          <span className="font-display text-[14px] font-medium tabular-nums">{STORY.amount}</span>
        </Row>
        <Row label="Merchant">{STORY.merchant}</Row>
        <Row label="Expires">{STORY.expires}</Row>
      </dl>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">Choose card</span>
        <span
          aria-hidden
          className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-2.5 text-[12px] font-medium"
        >
          <CardBadge />
          <span className="min-w-0 flex-1 truncate">{STORY.card}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
        </span>
      </div>
      <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <Lock className="size-3 shrink-0" strokeWidth={2.2} />
        Your card is never shared with the agent.
      </p>
      {/* Allow, then a grey full-width Deny under it, as the real screen has. */}
      <div className="flex flex-col gap-2">
        <FauxButton ready={ready} press={press} className="w-full">
          Allow
        </FauxButton>
        <span
          aria-hidden
          className="flex h-12 items-center justify-center rounded-2xl bg-muted text-[14px] font-semibold text-foreground select-none"
        >
          Deny
        </span>
      </div>
    </>
  );
}

/** The sheet body after approval: the check, the headline, what it granted. */
export function Approved({ at }: { at: number }) {
  return (
    <div className="flex flex-col items-start gap-3 pb-1">
      <CheckBurst at={at} size={48} />
      <div className="landing-fade flex flex-col gap-1" style={delay(at + 250)}>
        <p className="text-[22px] leading-[1.15] font-medium tracking-[-0.02em]">Approved.</p>
        <p className="text-[12px] text-muted-foreground">
          {STORY.agent} can spend up to{" "}
          <span className="font-display font-medium text-foreground tabular-nums">
            {STORY.amount}
          </span>{" "}
          until {STORY.expires}.
        </p>
      </div>
      <p className="landing-fade text-[11px] text-muted-foreground" style={delay(at + 450)}>
        You can close this. Revoke it any time from your wallet.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}
