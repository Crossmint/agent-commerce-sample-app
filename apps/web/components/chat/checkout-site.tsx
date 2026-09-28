"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { CheckoutSteps, cn, type CheckoutStep } from "@agent-commerce/ui";
import type { CheckoutSite } from "./parts";

/**
 * Where the agent went to buy, book or get tickets, said once as it gets
 * there: the site's icon and one small line, over the next message. The
 * updates from the site follow as messages of their own.
 */
export function CheckoutSiteLine({ site, className }: { site: CheckoutSite; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <SiteIcon host={site.host} size={14} />
      <span className="min-w-0 truncate">{siteLine(site)}</span>
    </div>
  );
}

/**
 * One stretch of a checkout, as the landing's phone shows it: the site's icon
 * and the task on top, with how long it has taken, then the step the agent is
 * on. Tap the header to see every step of the stretch; each ticks off as the
 * next arrives.
 */
export function CheckoutRunCard({
  site,
  title,
  steps,
  startedAt,
  endedAt,
  folded = "latest",
  compact = false,
  className,
}: {
  site: CheckoutSite;
  /** "Buying a box of IQBAR Chocolate Mint Chip", or "Continuing checkout" after an answer. */
  title: string;
  steps: CheckoutStep[];
  /** ISO 8601. Without it the card shows no clock. */
  startedAt?: string;
  /** ISO 8601, once the stretch is over. Until then the clock runs. */
  endedAt?: string;
  /**
   * What the card shows until it is opened: the latest step (a stretch that
   * runs, or ended with the purchase), or the title alone (a stretch that
   * stopped for the user, whose question is in the bubble below).
   */
  folded?: "latest" | "title";
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const foldedCount = folded === "title" ? 0 : 1;
  // Something to open: more steps than the folded card shows.
  const many = steps.length > foldedCount;
  const shown = open ? steps : steps.slice(steps.length - foldedCount);
  // The icon, the clock and the arrow sit on the title's line, not between the two lines.
  const header = (
    <>
      <span className="mt-0.5 shrink-0">
        <SiteIcon host={site.host} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="truncate text-[11px] text-muted-foreground">{site.host}</span>
      </span>
      {startedAt ? (
        <Elapsed
          startedAt={startedAt}
          endedAt={endedAt}
          className="mt-0.5 shrink-0 text-[11px] leading-4 text-muted-foreground"
        />
      ) : null}
      {many ? (
        <ChevronDown
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      ) : null}
    </>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-md flex-col gap-3 rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10",
        compact ? "p-3.5" : "p-4",
        className,
      )}
    >
      {many ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={
            open
              ? "Fold the steps"
              : steps.length === 1
                ? "Show the step"
                : `Show all ${steps.length} steps`
          }
          onClick={() => setOpen((o) => !o)}
          className="-m-1 flex items-start gap-2 rounded-xl p-1 text-left transition-colors hover:bg-muted/60"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start gap-2">{header}</div>
      )}
      {shown.length ? <CheckoutSteps steps={shown} /> : null}
    </div>
  );
}

/** How long a stretch has taken: "42s", "1m 05s". Ticks each second until it ends. */
function Elapsed({
  startedAt,
  endedAt,
  className,
}: {
  startedAt: string;
  endedAt?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endedAt]);
  const ms = (endedAt ? Date.parse(endedAt) : now) - Date.parse(startedAt);
  if (!Number.isFinite(ms)) return null;
  const secs = Math.max(0, Math.round(ms / 1000));
  const text =
    secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;
  return (
    <span className={cn("tabular-nums", className)} aria-label={`Took ${text}`}>
      {text}
    </span>
  );
}

/** "Buying a pouch of Sweet Fish on smartsweets.com", or "Going to smartsweets.com". */
export function siteLine(site: CheckoutSite): string {
  return site.action ? `${site.action} on ${site.host}` : `Going to ${site.host}`;
}

/**
 * The site's own icon, looked up by this app's server (`/api/favicon`), so
 * no third party learns where the user shops. A globe when the site has none.
 */
export function SiteIcon({ host, size }: { host: string; size: number }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Globe className="shrink-0" style={{ width: size, height: size }} />
  ) : (
    // A plain img: the icon is tiny, and not worth the image optimiser.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/favicon?host=${encodeURIComponent(host)}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[3px]"
      onError={() => setFailed(true)}
    />
  );
}
