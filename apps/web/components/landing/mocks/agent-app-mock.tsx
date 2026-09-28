import { ChevronsUpDown, Lock, MessageSquare, Plus, WalletCards } from "lucide-react";
import { AgentAvatar } from "@/components/brand";
import { cn } from "@/lib/cn";
import { CardBadge, delay } from "../bits";
import { STORY } from "../story";
import { WindowMock } from "./window-mock";

/*
 * Acme Agent on a laptop: a sidebar with New chat, Saved cards and the
 * history, and a thread with the approval card inline. The user allows the
 * budget where the conversation is. Rises in once on mount.
 */

const HISTORY = ["Usual coffee", "Coffee beans, 1 kg", "Flight to Denver"];

export function AgentAppMock({ className }: { className?: string }) {
  return (
    <WindowMock
      address={STORY.appAddress}
      className={cn("aspect-[4/5] text-[12px] sm:aspect-[16/11]", className)}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[34%] shrink-0 flex-col gap-1 border-r border-border bg-app-canvas p-2.5 sm:flex">
          <SideItem
            icon={<Plus className="size-3.5" strokeWidth={2.2} />}
            label="New chat"
            primary
          />
          <SideItem icon={<WalletCards className="size-3.5" />} label="Saved cards" />
          <p className="mt-3 px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Recent
          </p>
          {HISTORY.map((h, i) => (
            <SideItem
              key={h}
              icon={<MessageSquare className="size-3.5" />}
              label={h}
              active={i === 0}
            />
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <AgentAvatar size={22} />
            <span className="text-[12px] font-semibold">{STORY.agent}</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-4 py-3">
            <div
              className="landing-bubble ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground"
              style={delay(100)}
            >
              {STORY.ask}
            </div>
            <div
              className="landing-bubble mr-auto max-w-[78%] rounded-2xl rounded-bl-md bg-muted px-3 py-2"
              style={delay(500)}
            >
              On it. I need a {STORY.amount} budget for this order.
            </div>
            <div
              className="landing-bubble mr-auto w-[86%] max-w-[300px] rounded-2xl bg-card p-3.5 ring-1 ring-foreground/10"
              style={delay(900)}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted">
                  <Lock className="size-3.5" strokeWidth={2.2} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-[12px] leading-tight font-semibold">
                    Agent card request
                  </span>
                  <span className="truncate text-[10.5px] leading-tight text-muted-foreground">
                    {STORY.purpose} · expires {STORY.expires}
                  </span>
                </div>
              </div>
              <dl className="mt-3 flex flex-col divide-y divide-border rounded-xl bg-background ring-1 ring-foreground/10">
                <div className="flex justify-between px-3 py-1.5">
                  <dt className="text-muted-foreground">Purpose</dt>
                  <dd className="font-medium">{STORY.purpose}</dd>
                </div>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <dt className="text-muted-foreground">Limit</dt>
                  <dd className="font-display text-[13px] font-medium tabular-nums">
                    {STORY.amount}
                  </dd>
                </div>
              </dl>
              <div className="mt-2.5 flex h-9 items-center gap-2 rounded-xl border border-border px-2.5 font-medium">
                <CardBadge />
                <span className="min-w-0 flex-1 truncate">{STORY.card}</span>
                <ChevronsUpDown className="size-3.5 text-muted-foreground" />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span
                  aria-hidden
                  className="landing-press inline-flex h-9 flex-1 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground"
                  style={delay(2400)}
                >
                  Allow {STORY.amount}
                </span>
                <span
                  aria-hidden
                  className="inline-flex h-9 items-center justify-center rounded-full px-3 text-[12px] font-medium text-muted-foreground"
                >
                  Deny
                </span>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="flex h-9 items-center rounded-full bg-muted px-3.5 text-muted-foreground">
              Message the agent
            </div>
          </div>
        </div>
      </div>
    </WindowMock>
  );
}

function SideItem({
  icon,
  label,
  primary,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-7 items-center gap-2 truncate rounded-lg px-2 text-[11.5px] font-medium",
        primary
          ? "text-foreground ring-1 ring-foreground/10"
          : active
            ? "bg-muted text-foreground"
            : "text-muted-foreground",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
