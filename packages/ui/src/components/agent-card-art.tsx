"use client";

import * as React from "react";
import type { AgentCard, PaymentMethod } from "@agent-commerce/core";
import { cn } from "../lib/utils.js";
import { formatAmount, formatRelativeTime } from "../lib/format.js";
import { agentCardStatusBadge } from "./agent-card-list.js";
import { CardMark } from "./card-mark.js";
import { Badge } from "./primitives/badge.js";

export interface AgentCardArtProps {
  agentCard: AgentCard;
  /** The saved card the budget draws on. Its artwork goes in the corner. */
  paymentMethod?: PaymentMethod;
  className?: string;
}

/**
 * The budget drawn as a card: what is left of it in the middle, what it is
 * for under that, the merchant it is locked to and when it lapses along the
 * foot, and the network the money actually comes from in the corner.
 *
 * A card's proportions on purpose. This is not a credit card and never shows
 * a number, it is a spending limit, but it is the thing an agent pays with,
 * and a card shape says that faster than a panel does.
 *
 * Brand blue, with a soft lighter sweep from the top right. An expired
 * budget loses its colour.
 */
export function AgentCardArt({ agentCard, paymentMethod, className }: AgentCardArtProps) {
  const status = agentCardStatusBadge(agentCard);
  const spent = agentCard.amount.available !== agentCard.amount.total;
  const dead = status.label === "Expired" || status.label === "Revoked";

  return (
    <div
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-[0_12px_32px_-12px_color-mix(in_srgb,var(--primary)_45%,transparent)]",
        dead ? "bg-muted-foreground shadow-none" : "bg-primary",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/2 -right-1/4 size-[120%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.28),transparent)]"
      />

      <div className="relative flex items-start justify-between gap-3">
        <Badge variant={status.variant} className="bg-white/15 text-primary-foreground">
          {status.label}
        </Badge>
        {paymentMethod ? <CardMark paymentMethod={paymentMethod} /> : null}
      </div>

      <div className="relative flex flex-col gap-1">
        <p className="font-display text-3xl leading-none font-semibold tracking-tight tabular-nums">
          {formatAmount(agentCard.amount.available, agentCard.amount.currency)}
        </p>
        <p className="text-xs text-primary-foreground/70">
          {spent ? `of ${formatAmount(agentCard.amount.total, agentCard.amount.currency)} left` : "to spend"}
        </p>
      </div>

      <div className="relative flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm font-medium">{agentCard.description}</p>
          <p className="truncate text-xs text-primary-foreground/70">{agentCard.merchant?.name ?? "Any merchant"}</p>
        </div>
        <p className="shrink-0 text-xs whitespace-nowrap text-primary-foreground/70">{formatRelativeTime(agentCard.expiresAt)}</p>
      </div>
    </div>
  );
}
