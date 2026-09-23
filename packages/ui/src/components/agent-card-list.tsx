"use client";

import * as React from "react";
import {
  hasCardRail,
  needsCvcRecollection,
  pendingVerificationRails,
  type AgentCard,
  type OrderIntentRail,
} from "@agent-commerce/core";
import { RecollectCvc } from "./recollect-cvc.js";
import { VerifyAgentCard } from "./verify-agent-card.js";
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
  /** Called after the user finishes a pending network verification. Refetch here. */
  onVerified?: (agentCardId: string) => void | Promise<void>;
  /**
   * Called after the user types the saved card's security code again. Refetch
   * here: one card can back several budgets, so more than this row may have
   * come back to life.
   */
  onCvcRecollected?: (agentCardId: string) => void | Promise<void>;
  /** Hide cancelled and expired cards. Default false. */
  activeOnly?: boolean;
  className?: string;
  emptyAction?: React.ReactNode;
}

export function agentCardStatusBadge(card: AgentCard): {
  label: string;
  variant: BadgeProps["variant"];
} {
  const expired = new Date(card.expiresAt).getTime() < Date.now();
  if (card.status === "cancelled") return { label: "Revoked", variant: "muted" };
  if (card.status === "expired" || expired) return { label: "Expired", variant: "muted" };
  const pending = pendingVerificationRails(card).length > 0;
  if (hasCardRail(card)) return { label: "Active", variant: "success" };
  if (pending) return { label: "Needs verification", variant: "warning" };
  // Only ever true when no rail is live: a card that still pays says Active
  // above, whatever state its unused fallback is in.
  if (needsCvcRecollection(card)) return { label: "Needs security code", variant: "warning" };
  if (card.rails.some((r) => r.status === "active")) return { label: "Active", variant: "success" };
  return { label: "Inactive", variant: "muted" };
}

/** The piles a wallet sorts budgets into. */
export type AgentCardGroup = "active" | "needs-verification" | "needs-cvc" | "expired";

/**
 * Which pile a budget belongs to, from the same reading `agentCardStatusBadge`
 * makes — so the group a card lands in and the badge it wears can never
 * disagree. Revoked and inactive budgets join the expired pile: all three are
 * budgets nothing can be spent from again.
 */
export function agentCardGroup(card: AgentCard): AgentCardGroup {
  const { label } = agentCardStatusBadge(card);
  if (label === "Active") return "active";
  if (label === "Needs verification") return "needs-verification";
  if (label === "Needs security code") return "needs-cvc";
  return "expired";
}

export function RailBadge({ rail }: { rail: OrderIntentRail }) {
  const variant: BadgeProps["variant"] =
    rail.status === "active"
      ? "outline"
      : rail.status === "pending_verification" || rail.status === "pending_cvc_recollection"
        ? "warning"
        : "destructive";
  return (
    <Badge variant={variant} title={railLongLabel(rail)}>
      {railShortLabel(rail)}
      {rail.status !== "active" ? (
        <span className="opacity-70">· {rail.status.replace(/_/g, " ")}</span>
      ) : null}
    </Badge>
  );
}

export function AgentCardList({
  agentCards,
  loading = false,
  onRevoke,
  onVerified,
  onCvcRecollected,
  activeOnly = false,
  className,
  emptyAction,
}: AgentCardListProps) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState<string | null>(null);
  const [recollecting, setRecollecting] = React.useState<string | null>(null);

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
        const needsVerification =
          card.status === "active" && pendingVerificationRails(card).length > 0;
        // Verification first when a card wants both: either one unblocks it,
        // and the network rail is the one that holds the agent to the amount.
        const needsCvc = card.status === "active" && !needsVerification && needsCvcRecollection(card);
        const isVerifying = verifying === card.orderIntentId;
        const isRecollecting = recollecting === card.orderIntentId;
        return (
          <li
            key={card.orderIntentId}
            className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{card.description}</p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                {/* Money is the one thing set in the display face. */}
                <p className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                  {formatAmount(card.amount.available, card.amount.currency)}
                  <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">
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
              <div className="flex shrink-0 gap-2">
                {needsVerification && !isVerifying ? (
                  <Button type="button" size="sm" onClick={() => setVerifying(card.orderIntentId)}>
                    Verify
                  </Button>
                ) : null}
                {needsCvc && !isRecollecting ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setRecollecting(card.orderIntentId)}
                  >
                    Enter code
                  </Button>
                ) : null}
                {revocable ? (
                  <Button
                    type="button"
                    variant="secondary"
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
              </div>
            </div>
            {isVerifying ? (
              <div className="rounded-2xl bg-muted p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Confirm with your card network so agents can get a card number.
                </p>
                <VerifyAgentCard
                  agentCard={card}
                  onComplete={async () => {
                    setVerifying(null);
                    await onVerified?.(card.orderIntentId);
                  }}
                  onError={() => setVerifying(null)}
                />
              </div>
            ) : null}
            {isRecollecting ? (
              <div className="rounded-2xl bg-muted p-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Crossmint&rsquo;s copy of the security code for the card behind this budget
                  lapsed. Enter it again to bring the budget back.
                </p>
                <RecollectCvc
                  paymentMethodId={card.paymentMethodId}
                  onComplete={async () => {
                    setRecollecting(null);
                    await onCvcRecollected?.(card.orderIntentId);
                  }}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
