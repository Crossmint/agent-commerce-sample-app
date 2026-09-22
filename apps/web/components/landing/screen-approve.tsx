"use client";

import type { ReactNode } from "react";
import { ChevronsUpDown, Lock } from "lucide-react";
import { CardBadge, CheckBurst, delay, FauxButton } from "./bits";
import { AgentChatScreen, requestThread } from "./screen-chat";
import { STORY } from "./story";

/*
 * The approval sheet over the chat, the screen your platform hosts. Same
 * bones as the real `ApproveAgentCard`: headline, Purpose and Limit, the
 * card picker, one reassurance line, Allow. Timings are ms from mount.
 * Tokens only, so a `data-brand` wrapper re-themes the whole sheet, which is
 * what `make-it-yours` uses it for.
 *
 * One run: the chat plays (ask, reply, request card), the card's button
 * presses itself, the sheet slides up, Allow presses, Approved shows.
 */

export const APPROVE_T = {
  chat: { ask: 200, reply: 900, request: 1500 },
  /** The request card's button presses itself. */
  cardPress: 2300,
  sheet: 2600,
  ready: 3200,
  press: 4200,
  approvedAt: 4800,
} as const;
/** When the run has shown Approved for a moment, ms from mount. */
export const APPROVE_END = APPROVE_T.approvedAt + 1900;

export function ApproveScreen() {
  return (
    <div className="relative h-full">
      <AgentChatScreen
        messages={requestThread({ times: APPROVE_T.chat, pressAt: APPROVE_T.cardPress })}
      />
      <div
        aria-hidden
        className="landing-scrim absolute inset-0 z-30 bg-black/10"
        style={delay(APPROVE_T.sheet)}
      />
      <div
        className="landing-sheet absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[calc(var(--radius)+18px)] bg-background px-5 pt-3 pb-7 text-foreground"
        style={delay(APPROVE_T.sheet)}
      >
        <span aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted-strong" />
        <div className="relative">
          {/* The form gives way to the outcome in place, so the sheet keeps its height. */}
          <div className="landing-vanish flex flex-col gap-3" style={delay(APPROVE_T.approvedAt)}>
            <RequestForm ready={APPROVE_T.ready} press={APPROVE_T.press} />
          </div>
          <div className="absolute inset-x-0 top-0 flex flex-col gap-3">
            <Approved at={APPROVE_T.approvedAt + 100} />
          </div>
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
