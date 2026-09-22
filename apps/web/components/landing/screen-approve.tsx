"use client";

import type { ReactNode } from "react";
import { ChevronsUpDown, Lock } from "lucide-react";
import { CardBadge, CheckBurst, delay, FauxButton } from "./bits";
import { STORY } from "./story";

/*
 * The two bodies an approval sheet shows, in the order the real
 * `ApproveAgentCard` has them: the request (headline, Purpose, Limit,
 * Merchant and Expires, the card picker, one reassurance line, Allow and
 * Deny), then the outcome in its place. Timings are ms from mount. Tokens
 * only, so a `data-brand` wrapper re-themes both.
 *
 * The sheet that holds them belongs to whichever app is drawing it:
 * `screen-agent-app.tsx` for the agent app, `brand-app.tsx` for the brands.
 */

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
