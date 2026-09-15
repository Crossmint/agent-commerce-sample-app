"use client";

import * as React from "react";
import type { AgentCard, OrderIntentRail } from "@goat-wallet/core";
import { cn } from "../lib/utils.js";
import { formatAmount, formatDate, railLongLabel, railShortLabel } from "../lib/format.js";
import { Badge, type BadgeProps } from "./primitives/badge.js";
import { Button } from "./primitives/button.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";
import { EmptyState } from "./mascot.js";

export interface AgentCardListProps {
  agentCards: AgentCard[] | undefined;
  loading?: boolean;
  onRevoke?: (agentCardId: string) => void | Promise<void>;
  /** Hide cancelled and expired cards. Default false. */
  activeOnly?: boolean;
  className?: string;
  mascotSrc?: string;
  emptyAction?: React.ReactNode;
}

export function agentCardStatusBadge(card: AgentCard): { label: string; variant: BadgeProps["variant"] } {
  const expired = new Date(card.expiresAt).getTime() < Date.now();
  if (card.status === "cancelled") return { label: "Revoked", variant: "muted" };
  if (card.status === "expired" || expired) return { label: "Expired", variant: "muted" };
  const pending = card.rails.some((r) => r.status === "pending_verification");
  const active = card.rails.some((r) => r.status === "active");
  if (active) return { label: "Active", variant: "success" };
  if (pending) return { label: "Needs verification", variant: "warning" };
  return { label: "Inactive", variant: "muted" };
}

export function RailBadge({ rail }: { rail: OrderIntentRail }) {
  const variant: BadgeProps["variant"] =
    rail.status === "active" ? "outline" : rail.status === "pending_verification" ? "warning" : "destructive";
  return (
    <Badge variant={variant} title={railLongLabel(rail)}>
      {railShortLabel(rail)}
      {rail.status !== "active" ? <span className="opacity-70">· {rail.status.replace(/_/g, " ")}</span> : null}
    </Badge>
  );
}

export function AgentCardList({
  agentCards,
  loading = false,
  onRevoke,
  activeOnly = false,
  className,
  mascotSrc,
  emptyAction,
}: AgentCardListProps) {
  const [busy, setBusy] = React.useState<string | null>(null);

  if (loading && !agentCards) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const cards = (agentCards ?? []).filter((c) => !activeOnly || c.status === "active");

  if (!cards.length) {
    return (
      <EmptyState
        className={className}
        mascotSrc={mascotSrc}
        title="No agent cards yet"
        description="When an agent asks to spend, you approve it here."
        action={emptyAction}
      />
    );
  }

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {cards.map((card) => {
        const status = agentCardStatusBadge(card);
        const revocable = card.status === "active" && onRevoke;
        return (
          <li
            key={card.orderIntentId}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{card.description}</p>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="text-2xl font-semibold tracking-tight">
                {formatAmount(card.amount.available, card.amount.currency)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  of {formatAmount(card.amount.total, card.amount.currency)} available
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {card.rails.map((r) => (
                  <RailBadge key={`${r.rail}-${"provider" in r ? r.provider : ""}`} rail={r} />
                ))}
                {card.merchant ? <span>· {card.merchant.name}</span> : null}
                <span>· until {formatDate(card.expiresAt)}</span>
              </div>
            </div>
            {revocable ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy === card.orderIntentId}
                onClick={async () => {
                  setBusy(card.orderIntentId);
                  try {
                    await onRevoke(card.orderIntentId);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === card.orderIntentId ? <Spinner /> : null}
                Revoke
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
