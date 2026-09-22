"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { delay, Typed, typedFor } from "../bits";
import { STORY } from "../story";
import { useStepLoop } from "../use-step-loop";
import { WindowMock } from "./window-mock";

/*
 * A terminal agent driving Acme's own CLI, built on @agent-commerce/cli.
 * It signs in, asks for an agent card and waits for the approval, then
 * creates the checkout and waits for the receipt. Commands type in, output
 * lands line by line, and the whole run replays on a loop while in view.
 */

const SPEED = 22;
const CMD_LOGIN = `${STORY.cli} login`;
const CMD_CARD = `${STORY.cli} card request --amount ${STORY.amountBare} --description "${STORY.purpose}" --wait`;
const CMD_CHECKOUT = `${STORY.cli} checkout --url ${STORY.productUrl} --card ${STORY.agentCardId} --wait`;

const T = (() => {
  const login = 400;
  const loggedIn = login + typedFor(CMD_LOGIN, SPEED) + 300;
  const cmd1 = loggedIn + 700;
  const out1 = cmd1 + typedFor(CMD_CARD, SPEED) + 300;
  const waiting = out1 + 500;
  const approved = waiting + 1600;
  const cmd2 = approved + 900;
  const out2 = cmd2 + typedFor(CMD_CHECKOUT, SPEED) + 300;
  const steps = [out2 + 500, out2 + 1200, out2 + 1900, out2 + 2600];
  const done = out2 + 3400;
  const loop = done + 4200;
  return { login, loggedIn, cmd1, out1, waiting, approved, cmd2, out2, steps, done, loop };
})();

export function TerminalMock({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: T.loop });
  return (
    <div ref={ref} className={cn("flex w-full flex-col gap-3", className)}>
      <WindowMock tone="dark" address="zsh" className="aspect-[3/4] sm:aspect-[16/11]">
        <pre
          key={cycle}
          className="scrollbar-none m-0 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-4 font-mono text-[11px] leading-[1.6] whitespace-pre-wrap break-all text-background/85 sm:text-[12px]"
        >
          <Line>
            <Prompt />
            <Typed
              text={CMD_LOGIN}
              at={T.login}
              speed={SPEED}
              className="whitespace-pre-wrap text-background"
            />
          </Line>
          <Out at={T.loggedIn}>
            <Ok /> Signed in to {STORY.agentDomain}.
          </Out>
          <Line className="mt-2">
            <Prompt at={T.cmd1} />
            <Typed
              text={CMD_CARD}
              at={T.cmd1}
              speed={SPEED}
              className="whitespace-pre-wrap text-background"
            />
          </Line>
          <Out at={T.out1}>
            Approve at{" "}
            <span className="underline decoration-background/40 underline-offset-2">
              {STORY.approveUrl}
            </span>
          </Out>
          <Out at={T.waiting} muted>
            Waiting for approval…
          </Out>
          <Out at={T.approved}>
            <Ok /> Approved. Card {STORY.agentCardId} · {STORY.amount} · {STORY.card}
          </Out>
          <Line className="mt-2">
            <Prompt at={T.cmd2} />
            <Typed
              text={CMD_CHECKOUT}
              at={T.cmd2}
              speed={SPEED}
              className="whitespace-pre-wrap text-background"
            />
          </Line>
          {STORY.checkoutSteps.slice(0, 4).map((label, i) => (
            <Out key={label} at={T.steps[i] ?? T.out2} muted>
              {label.toLowerCase()}…
            </Out>
          ))}
          <Out at={T.done}>
            <Ok /> succeeded · order {STORY.order} · paid {STORY.receipt.total}
          </Out>
        </pre>
      </WindowMock>
      <p className="text-[13px] text-muted-foreground">
        Your CLI, built on{" "}
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
          @agent-commerce/cli
        </code>
      </p>
    </div>
  );
}

function Line({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("block", className)}>{children}</span>;
}

function Prompt({ at }: { at?: number }) {
  return (
    <span
      className={cn("mr-2 text-background/50 select-none", at !== undefined && "landing-fade")}
      style={at !== undefined ? delay(at) : undefined}
    >
      $
    </span>
  );
}

function Out({ at, muted, children }: { at: number; muted?: boolean; children: ReactNode }) {
  return (
    <span className={cn("landing-fade block", muted && "text-background/55")} style={delay(at)}>
      {children}
    </span>
  );
}

function Ok() {
  return (
    <span className="mr-1 inline-flex size-3.5 translate-y-[2px] items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check className="size-2.5" strokeWidth={3.5} />
    </span>
  );
}
