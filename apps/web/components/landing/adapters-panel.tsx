"use client";

import { Server, SquareTerminal, Wallet, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStepLoop } from "./use-step-loop";

/** The three ways an agent reaches the wallet. Shown as cards wired to the GOAT mark. */
export const ADAPTERS = [
  { title: "Agent tools", code: "request_agent_card({ amount: 8 })", Icon: Wrench },
  { title: "MCP server", code: "POST /api/mcp", Icon: Server },
  { title: "CLI + Skills", code: "goat agent-card request --amount 8", Icon: SquareTerminal },
] as const;

/** Card centers at 1/6, 1/2 and 5/6 of the height, in a 300-tall viewBox. */
const WIRES = ["M0 150 C 30 150, 26 50, 56 50", "M0 150 L 56 150", "M0 150 C 30 150, 26 250, 56 250"];

/**
 * A compact "connections" panel, the same height as a phone so the three
 * blocks line up: a plain "Your agent wallet" node on the left, three
 * adapter cards on the right, thin wires between them that light up in turn.
 */
export function AdaptersPanel({ className }: { className?: string }) {
  const { ref, step, cycle } = useStepLoop<HTMLDivElement>(ADAPTERS.length, { interval: 1900 });
  return (
    <div ref={ref} className={cn("relative flex", className)}>
      <div aria-hidden className="landing-glow absolute -inset-10 -z-10" />
      <div
        role="img"
        aria-label="A node labeled Your agent wallet, wired to three adapter cards: Agent tools, MCP server, and CLI + Skills. The wires light up one at a time."
        className="grid w-full grid-cols-[auto_44px_minmax(0,1fr)] items-stretch py-6 lg:min-h-[calc((var(--phone-w)-20px)*852/393+20px)] lg:grid-cols-[auto_64px_minmax(0,1fr)]"
      >
        <div className="flex w-[92px] flex-col items-center justify-center gap-2 self-center rounded-md border border-border bg-card px-2 py-3.5 text-center">
          <Wallet className="size-5 text-primary" strokeWidth={1.75} />
          <span className="text-[11.5px] leading-tight font-semibold">Your agent wallet</span>
        </div>

        <svg viewBox="0 0 56 300" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          {WIRES.map((d, i) => (
            <path key={i} d={d} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="landing-wire" />
          ))}
          {WIRES.map((d, i) =>
            i === step ? <path key={`${cycle}-${i}`} d={d} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="landing-wire-lit" /> : null,
          )}
        </svg>

        <div className="grid grid-rows-3 gap-3">
          {ADAPTERS.map((a, i) => (
            <div key={a.title} data-active={i === step} className="landing-adapter flex min-w-0 flex-col justify-center gap-2 rounded-md border border-border bg-card p-3.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <a.Icon className={cn("size-4 shrink-0", i === step ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} />
                {a.title}
              </span>
              <code className={cn("block truncate font-mono text-[11px] transition-colors duration-300", i === step ? "text-foreground" : "text-muted-foreground")}>{a.code}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
