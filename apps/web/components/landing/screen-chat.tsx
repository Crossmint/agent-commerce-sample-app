"use client";

import { ArrowUp, ChevronLeft, Lock, Plus } from "lucide-react";
import { AgentAvatar } from "@/components/brand";
import { cn } from "@/lib/cn";
import { delay, RunMark, RunStep } from "./bits";
import { type ChatMessage, delayStyle, endsGroup } from "./chat/model";
import { messageAttrs, useFollowLatest } from "./chat/use-follow-latest";
import { ReceiptCard } from "./receipt-card";
import { STORY } from "./story";

/*
 * Acme Agent's own chat, inside the phone. The header carries the Acme
 * avatar and name, bubbles are the theme's primary and muted, cards sit bare
 * in the thread, and a pill composer closes the screen. Bubbles land on CSS
 * delays from mount; the phone remounts the screen to replay it. Every color
 * and corner is a theme token, so a `data-brand` wrapper re-themes it.
 */

export function AgentChatScreen({
  messages,
  className,
}: {
  messages: ChatMessage[];
  className?: string;
}) {
  const thread = useFollowLatest<HTMLDivElement>();
  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background text-[12.5px] leading-[1.35] text-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-11 pb-2">
        <ChevronLeft className="size-5 text-foreground" strokeWidth={2} />
        <AgentAvatar size={28} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px] leading-tight font-semibold">{STORY.agent}</span>
          <span className="truncate text-[10px] leading-tight text-muted-foreground">
            {STORY.agentDomain}
          </span>
        </div>
      </div>
      <div ref={thread} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mt-auto flex flex-col gap-2 px-3 pt-2 pb-2">
          {messages.map((m, i) => (
            <div
              key={m.key}
              {...messageAttrs(m.at)}
              className={cn("landing-bubble flex flex-col", !endsGroup(messages, i) && "-mb-1")}
              style={delayStyle(m.at)}
            >
              <Message m={m} />
            </div>
          ))}
        </div>
      </div>
      <Composer />
    </div>
  );
}

function Message({ m }: { m: ChatMessage }) {
  if (m.from === "status")
    return (
      <p className="my-0.5 text-center text-[10.5px] font-medium text-muted-foreground">{m.node}</p>
    );
  if (m.card && m.bare)
    return (
      <div className={cn("flex w-[88%]", m.from === "user" ? "ml-auto" : "mr-auto")}>{m.card}</div>
    );
  const sent = m.from === "user";
  return (
    <div
      className={cn(
        "max-w-[82%] rounded-2xl px-3 py-2",
        sent
          ? "ml-auto rounded-br-md bg-primary text-primary-foreground"
          : "mr-auto rounded-bl-md bg-muted text-foreground",
      )}
    >
      {m.card ?? m.node}
    </div>
  );
}

function Composer() {
  return (
    <div aria-hidden className="flex items-center gap-2 px-3 pt-1.5 pb-7">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Plus className="size-4" strokeWidth={2.2} />
      </span>
      <span className="flex h-9 flex-1 items-center justify-between rounded-full bg-muted pr-1 pl-3.5 text-[12px] text-muted-foreground">
        Message
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ArrowUp className="size-3.5" strokeWidth={3} />
        </span>
      </span>
    </div>
  );
}

/* ---------- Cards that ride in the thread ---------- */

/** The agent's request for a budget, as the chat shows it: who wants what, and a Review button. */
export function RequestCard({ press }: { press?: number }) {
  return (
    <div className="flex w-full flex-col gap-2.5 rounded-2xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Lock className="size-3.5" strokeWidth={2.2} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[12px] leading-tight font-semibold">Agent card request</span>
          <span className="truncate text-[10.5px] leading-tight text-muted-foreground">
            Expires {STORY.expires}
          </span>
        </div>
      </div>
      <p className="text-[12px] leading-snug">
        {STORY.agent} wants to spend up to{" "}
        <span className="font-display font-medium tabular-nums">{STORY.amount}</span> for{" "}
        {STORY.purpose}.
      </p>
      <span
        aria-hidden
        className={cn(
          "flex h-8 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground",
          press !== undefined && "landing-press",
        )}
        style={press !== undefined ? delay(press) : undefined}
      >
        Review and approve
      </span>
    </div>
  );
}

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

/* ---------- Scripts ---------- */

/** When the ask, the reply and the request card land, ms from mount. */
export interface RequestTimes {
  ask: number;
  reply: number;
  request: number;
}

export const REQUEST_T: RequestTimes = { ask: 300, reply: 1300, request: 2000 };
/** The ask and the agent's request. */
export const REQUEST_END = REQUEST_T.request;

export function requestThread(
  opts: { pressAt?: number; settled?: boolean; times?: RequestTimes } = {},
): ChatMessage[] {
  const t = opts.times ?? REQUEST_T;
  const at = (ms: number) => (opts.settled ? 0 : ms);
  return [
    { key: "ask", from: "user", at: at(t.ask), node: STORY.ask },
    {
      key: "reply",
      from: "agent",
      at: at(t.reply),
      node: <>On it. I need a {STORY.amount} budget for this order. Approve it here:</>,
    },
    {
      key: "request",
      from: "agent",
      at: at(t.request),
      bare: true,
      card: <RequestCard press={opts.pressAt} />,
    },
  ];
}

/** After approval: the checkout runs in the thread, then the receipt lands. */
export const CHECKOUT_T = {
  approved: 200,
  ordering: 700,
  card: 1200,
  steps: [1900, 2700, 3500, 4300, 5100],
  done: 5800,
  receipt: 6400,
} as const;

export function checkoutThread(): ChatMessage[] {
  return [
    ...requestThread({ settled: true }),
    {
      key: "approved",
      from: "status",
      at: CHECKOUT_T.approved,
      node: (
        <>
          You approved {STORY.amount} · {STORY.card}
        </>
      ),
    },
    {
      key: "ordering",
      from: "agent",
      at: CHECKOUT_T.ordering,
      node: <>Ordering at {STORY.domain}…</>,
    },
    {
      key: "progress",
      from: "agent",
      at: CHECKOUT_T.card,
      bare: true,
      card: <ProgressCard from={CHECKOUT_T.card} steps={[...CHECKOUT_T.steps]} />,
    },
    {
      key: "done",
      from: "agent",
      at: CHECKOUT_T.done,
      node: <>Done. Order #{STORY.order} arrives Thursday.</>,
    },
    { key: "receipt", from: "agent", at: CHECKOUT_T.receipt, bare: true, card: <ReceiptCard /> },
  ];
}
