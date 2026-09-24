"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Globe } from "lucide-react";
import { Spinner, cn } from "@agent-commerce/ui";
import type { CheckoutPhase, CheckoutSite } from "./parts";

export const PHASE_LABEL: Record<CheckoutPhase, string> = {
  starting: "Opening the site",
  working: "On it",
  waiting: "Waiting for you",
  done: "Done",
  stopped: "Stopped",
};

/**
 * The site a checkout runs on, where the agent starts it: the site's icon,
 * what the agent is doing there in its own words, the domain, and where the
 * run stands. It tells the user the agent went to buy, book or get tickets on
 * a real website, before the updates from that site come in.
 */
export function CheckoutSiteCard({
  site,
  phase,
  compact = false,
  className,
}: {
  site: CheckoutSite;
  phase: CheckoutPhase;
  /** The phone's smaller card. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-lg items-center gap-3 rounded-2xl bg-card ring-1 ring-foreground/10",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <SiteIcon host={site.host} size={compact ? 36 : 40} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {site.action ?? `Visiting ${site.host}`}
        </span>
        <span className="truncate text-xs text-muted-foreground">{site.host}</span>
      </div>
      <PhaseBadge phase={phase} />
    </div>
  );
}

/**
 * The site's own icon, looked up by this app's server (`/api/favicon`), so
 * no third party learns where the user shops. A globe when the site has none.
 */
export function SiteIcon({ host, size }: { host: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const icon = Math.round(size * 0.55);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-muted"
      style={{ width: size, height: size }}
    >
      {failed ? (
        <Globe className="text-muted-foreground" style={{ width: icon, height: icon }} />
      ) : (
        // A plain img: the icon is tiny, remote and not worth the image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/favicon?host=${encodeURIComponent(host)}`}
          alt=""
          width={icon}
          height={icon}
          className="rounded-[4px]"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: CheckoutPhase }) {
  const busy = phase === "starting" || phase === "working";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        phase === "done" && "bg-success/10 text-success",
        phase === "stopped" && "bg-destructive/10 text-destructive",
        phase === "waiting" && "bg-warning/15 text-warning",
        busy && "bg-muted text-muted-foreground",
      )}
    >
      {busy ? <Spinner className="size-3" /> : null}
      {phase === "done" ? <CircleCheck className="size-3" /> : null}
      {phase === "stopped" ? <CircleAlert className="size-3" /> : null}
      {PHASE_LABEL[phase]}
    </span>
  );
}
