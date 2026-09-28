"use client";

import { ArrowUp, ChevronsUpDown, CreditCard, House, Lock, User } from "lucide-react";
import { AgentAvatar } from "@/components/brand";
import type { BrandTheme } from "@/components/brand-themes";
import { cn } from "@/lib/cn";
import { CardBadge, CheckBurst, delay, FauxButton } from "./bits";
import { AppApproveScreen, APP_APPROVE_T } from "./screen-app-steps";
import { STORY } from "./story";

/*
 * The same approval, as three different apps.
 *
 * The point of the brand section is not that the colors move: it is that the
 * whole screen is yours. So each brand gets its own shape as well as its own
 * tokens, and the three do not share a layout:
 *
 * - acme  a chat with the approval on a bottom sheet. This is the app the
 *         hero and `how-it-works` show, rendered by AppApproveScreen itself,
 *         so the default brand and the hero cannot drift apart.
 * - nova  a tab-bar app. Both sides speak in pills, and the approval takes
 *         the whole screen: the figure first, the details in a grid, Deny and
 *         Allow side by side.
 * - maple a paper transcript. Senders are named above their turn, rules
 *         separate the turns instead of bubbles, and the approval never
 *         covers anything — it opens in the thread where it was asked.
 *
 * Colors, corners and type still come from the brand's tokens; only the
 * arrangement is written here. Every timing is ms from mount, on the shared
 * beats in `APP_APPROVE_T`, so one loop fits all three.
 */

const T = APP_APPROVE_T;

export function BrandAppScreen({ brand }: { brand: BrandTheme }) {
  if (brand === "nova") return <NovaApp />;
  if (brand === "maple") return <MapleApp />;
  return <AppApproveScreen />;
}

/** What each layout says it is, for the phone's accessible description. */
export const BRAND_LAYOUT_NOTE: Record<BrandTheme, string> = {
  acme: "a chat with the approval on a bottom sheet",
  nova: "a tab-bar app with the approval on its own full screen",
  maple: "a paper transcript with the approval opening inline in the thread",
};

/* ---------- Nova: tab bar, pill bubbles, full-screen approval ---------- */

function NovaApp() {
  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <div className="flex flex-col items-center gap-1 px-4 pt-11 pb-3">
        <AgentAvatar size={30} />
        <span className="text-[12px] font-semibold">{STORY.agent}</span>
        <span className="text-[9.5px] text-muted-foreground">Online</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 px-3.5 pb-2">
        <Pill side="user" at={0}>
          {STORY.ask}
        </Pill>
        <Pill side="agent" at={220}>
          I need a {STORY.amount} budget on your card for this.
        </Pill>
        <Pill side="agent" at={440}>
          Opening the approval…
        </Pill>
      </div>

      <div aria-hidden className="px-3.5 pb-2">
        <div className="flex h-9 items-center gap-2 rounded-full bg-muted pr-1 pl-3.5">
          <span className="flex-1 truncate text-[11.5px] text-muted-foreground">Message</span>
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ArrowUp className="size-3.5" strokeWidth={2.5} />
          </span>
        </div>
      </div>

      {/* A tab bar, not round buttons in a header: a different app at a glance. */}
      <div
        aria-hidden
        className="flex items-center justify-around border-t border-border px-4 pt-2 pb-6"
      >
        <Tab Icon={House} label="Chat" active />
        <Tab Icon={CreditCard} label="Cards" />
        <Tab Icon={User} label="You" />
      </div>

      {/* The approval owns the screen. It does not slide over a thread, it replaces it. */}
      <div
        className="landing-sheet absolute inset-0 z-40 flex flex-col bg-background px-5 pt-11 pb-6"
        style={delay(T.up)}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="landing-vanish flex min-h-0 flex-1 flex-col" style={delay(T.approved)}>
            <p className="text-[11px] text-muted-foreground">{STORY.agent} is asking for</p>
            <p className="font-display text-[40px] leading-[1.05] font-medium tracking-[-0.03em] text-primary tabular-nums">
              {STORY.amount}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
              <Cell label="Purpose">{STORY.purpose}</Cell>
              <Cell label="Merchant">{STORY.merchant}</Cell>
              <Cell label="Expires">{STORY.expires}</Cell>
              <Cell label="Limit">{STORY.amount}</Cell>
            </div>
            <span
              aria-hidden
              className="mt-4 flex h-11 items-center gap-2 rounded-full bg-muted px-3 text-[12px] font-medium"
            >
              <CardBadge />
              <span className="min-w-0 flex-1 truncate">{STORY.card}</span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
            </span>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Lock className="size-3 shrink-0" strokeWidth={2.2} />
              Your card is never shared with the agent.
            </p>
            {/* Side by side, where Acme stacks them. */}
            <div className="mt-auto flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-muted text-[13px] font-semibold select-none"
              >
                Deny
              </span>
              <FauxButton
                ready={T.ready}
                press={T.press}
                className="h-12 flex-1 rounded-full text-[13px]"
              >
                Allow
              </FauxButton>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <CheckBurst at={T.approved} size={52} />
            <div className="landing-fade flex flex-col gap-1" style={delay(T.approved + 250)}>
              <p className="text-[20px] leading-tight font-medium">Approved</p>
              <p className="text-[11px] text-muted-foreground">
                {STORY.amount} until {STORY.expires}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({
  side,
  at,
  children,
}: {
  side: "user" | "agent";
  at: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "landing-bubble max-w-[82%] rounded-[1.25rem] px-3.5 py-2 text-[12px] leading-snug",
        side === "user"
          ? "ml-auto bg-primary text-primary-foreground"
          : "mr-auto bg-muted text-foreground",
      )}
      style={delay(at)}
    >
      {children}
    </span>
  );
}

function Tab({ Icon, label, active }: { Icon: typeof House; label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "flex flex-col items-center gap-1 text-[8.5px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" strokeWidth={2} />
      {label}
    </span>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-muted px-3 py-2">
      <span className="text-[9px] tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="truncate text-[11.5px] font-medium">{children}</span>
    </div>
  );
}

/* ---------- Maple: paper transcript, approval inline in the thread ---------- */

function MapleApp() {
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex flex-col items-center border-b border-border px-4 pt-11 pb-2">
        <span className="font-display text-[15px] font-medium tracking-[-0.01em]">
          {STORY.company}
        </span>
        <span className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
          Assistant
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end divide-y divide-border px-4">
        <Turn who="You" at={0}>
          {STORY.ask}
        </Turn>
        <Turn who={STORY.agent} at={220}>
          I need a {STORY.amount} budget on your card for this. The request is below.
        </Turn>
        {/* No sheet and no scrim: the approval opens where it was asked. */}
        <div className="py-3">
          <div className="relative">
            <div className="landing-vanish" style={delay(T.approved)}>
              <div
                className="landing-fade flex flex-col gap-2.5 border border-foreground/15 p-3"
                style={delay(T.up)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                    Card request
                  </span>
                  <span className="font-display text-[20px] leading-none font-medium tabular-nums">
                    {STORY.amount}
                  </span>
                </div>
                <dl className="flex flex-col divide-y divide-border text-[11px]">
                  <MapleRow label="Purpose">{STORY.purpose}</MapleRow>
                  <MapleRow label="Merchant">{STORY.merchant}</MapleRow>
                  <MapleRow label="Expires">{STORY.expires}</MapleRow>
                  <MapleRow label="Card">{STORY.card}</MapleRow>
                </dl>
                <FauxButton
                  ready={T.ready}
                  press={T.press}
                  className="h-10 w-full rounded-none text-[12px]"
                >
                  Allow this request
                </FauxButton>
                <span
                  aria-hidden
                  className="text-center text-[10.5px] text-muted-foreground underline underline-offset-2"
                >
                  Decline
                </span>
              </div>
            </div>
            <div
              className="landing-fade absolute inset-x-0 top-0 flex flex-col gap-1 border-l-2 border-primary pl-3"
              style={delay(T.approved + 100)}
            >
              <span className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                Approved
              </span>
              <p className="font-display text-[17px] leading-tight font-medium">
                {STORY.amount} until {STORY.expires}
              </p>
              <p className="text-[10.5px] text-muted-foreground">
                Revoke it any time from your wallet.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* A square field with a word for a button, where the others use a round icon. */}
      <div aria-hidden className="flex items-center gap-2 border-t border-border px-4 pt-2 pb-6">
        <span className="h-9 flex-1 border border-border px-2.5 pt-2 text-[11.5px] text-muted-foreground">
          Write a message
        </span>
        <span className="text-[11.5px] font-semibold text-primary">Send</span>
      </div>
    </div>
  );
}

function Turn({ who, at, children }: { who: string; at: number; children: React.ReactNode }) {
  return (
    <div className="landing-bubble flex flex-col gap-1 py-3" style={delay(at)}>
      <span className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">{who}</span>
      <p className="text-[12px] leading-relaxed">{children}</p>
    </div>
  );
}

function MapleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}
