"use client";

import * as React from "react";
import { pendingVerificationRails, type AgentCard, type PaymentMethod } from "@agent-commerce/core";
import { MoreHorizontal } from "lucide-react";
import { VerifyAgentCard } from "./verify-agent-card.js";
import { cn } from "../lib/utils.js";
import { formatAmount, formatDateTime, formatRelativeTime, paymentMethodLabel } from "../lib/format.js";
import { useMediaQuery } from "../hooks/use-media-query.js";
import { agentCardStatusBadge } from "./agent-card-list.js";
import { CardMark } from "./card-mark.js";
import { Badge } from "./primitives/badge.js";
import { Button } from "./primitives/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./primitives/dropdown-menu.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./primitives/table.js";
import { EmptyState } from "./mascot.js";

export interface AgentCardTableProps {
  agentCards: AgentCard[] | undefined;
  /** The user's saved cards, so each budget can show the one that backs it. */
  paymentMethods?: PaymentMethod[];
  loading?: boolean;
  onRevoke?: (agentCardId: string) => void | Promise<void>;
  /** Called after the user finishes a pending network verification. Refetch here. */
  onVerified?: (agentCardId: string) => void | Promise<void>;
  /** Opens a row. With it, rows become buttons; without it they are plain. */
  onSelect?: (agentCard: AgentCard) => void;
  /** Hide cancelled and expired cards. Default false. */
  activeOnly?: boolean;
  className?: string;
  mascotSrc?: string;
  emptyAction?: React.ReactNode;
}

/*
 * The two columns that step back when the table cannot hold them all, and the
 * queries that say when. Budget, Available and Status carry the point without
 * either of them.
 *
 * The breakpoints sit a step higher than the content needs on its own, because
 * the wallet puts this table beside a 16rem sidebar: what the viewport is wide
 * enough for and what the column is wide enough for are two different numbers,
 * and a media query only knows the first. A container query would know the
 * second, but the verify panel below has to count the columns it spans, and
 * nothing reads a container query back out in JavaScript.
 *
 * The classes hide a column without a flash on the first paint; the queries
 * answer how many columns a row actually has. Keep the two in step.
 */
const COLUMNS = [
  { className: "", query: undefined },
  { className: "hidden lg:table-cell", query: "(min-width: 1024px)" },
  { className: "", query: undefined },
  { className: "hidden xl:table-cell", query: "(min-width: 1280px)" },
  { className: "", query: undefined },
  { className: "", query: undefined },
] as const;

const [BUDGET, CARD, AVAILABLE, EXPIRES, STATUS, ACTIONS] = COLUMNS;

/**
 * Every budget the user approved, newest first: what it is for, the card
 * behind it, what is left of it, when it lapses, and one menu for the two
 * things they can do about it.
 *
 * The same data as `AgentCardList`, which stays for narrow columns and for
 * anywhere a list reads better. A table is what the wallet wants: budgets are
 * one shape repeated, and a column of amounts is read down.
 *
 * Verifying opens under its own row rather than in a dialog, so the row it
 * belongs to stays in sight.
 */
export function AgentCardTable({
  agentCards,
  paymentMethods,
  loading = false,
  onRevoke,
  onVerified,
  onSelect,
  activeOnly = false,
  className,
  mascotSrc,
  emptyAction,
}: AgentCardTableProps) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState<string | null>(null);

  // How wide the verify panel has to be. Both queries settle before anyone can
  // open the panel, which is the only thing that reads them.
  const wideEnoughForCard = useMediaQuery(CARD.query!);
  const wideEnoughForExpires = useMediaQuery(EXPIRES.query!);
  const visibleColumns = 4 + Number(wideEnoughForCard) + Number(wideEnoughForExpires);

  const byId = React.useMemo(() => {
    const map = new Map<string, PaymentMethod>();
    for (const pm of paymentMethods ?? []) map.set(pm.paymentMethodId, pm);
    return map;
  }, [paymentMethods]);

  /*
   * Newest first.
   *
   * Crossmint's order-intents endpoint does not send `createdAt` today, and
   * the list comes back in no order the user would recognise. So when not one
   * budget carries the field, the expiry stands in for it: every budget is
   * created with a window ahead of it, and a later window is a later budget.
   * That is a proxy, not the truth — the day the field arrives it takes over,
   * and mixing the two clocks in one comparison would interleave them wrongly.
   */
  const cards = React.useMemo(() => {
    const rows = (agentCards ?? []).filter((c) => !activeOnly || c.status === "active");
    const dated = rows.some((c) => c.createdAt);
    const at = (c: AgentCard) => new Date((dated ? c.createdAt : c.expiresAt) ?? 0).getTime() || 0;
    return rows.sort((a, b) => at(b) - at(a));
  }, [agentCards, activeOnly]);

  if (loading && !agentCards) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <Skeleton className="h-10" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

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
    <Table containerClassName={className}>
      <TableHeader>
        <TableRow>
          <TableHead className={BUDGET.className}>Budget</TableHead>
          <TableHead className={CARD.className}>Card</TableHead>
          <TableHead className={cn(AVAILABLE.className, "text-right")}>Available</TableHead>
          <TableHead className={EXPIRES.className}>Expires</TableHead>
          <TableHead className={STATUS.className}>Status</TableHead>
          <TableHead className={cn(ACTIONS.className, "w-0 text-right")}>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cards.map((card) => {
          const status = agentCardStatusBadge(card);
          const revocable = card.status === "active" && Boolean(onRevoke);
          const needsVerification = card.status === "active" && pendingVerificationRails(card).length > 0;
          const isVerifying = verifying === card.orderIntentId;
          const spent = card.amount.available !== card.amount.total;
          const pm = byId.get(card.paymentMethodId);
          const working = busy === card.orderIntentId;
          return (
            <React.Fragment key={card.orderIntentId}>
              <TableRow
                // A row is the way into the budget. A `tr` cannot be a button,
                // so it carries the role and the key handler itself; the menu
                // at the end stops the click so the two do not both fire.
                {...(onSelect
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      "aria-label": `Open ${card.description}`,
                      onClick: () => onSelect(card),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        onSelect(card);
                      },
                    }
                  : {})}
                className={cn(
                  isVerifying && "border-b-0",
                  onSelect && "cursor-pointer outline-none focus-visible:bg-accent focus-visible:inset-ring-2 focus-visible:inset-ring-ring/60",
                )}
              >
                {/* The description gives way first: it truncates, and the columns
                    beside it do not. */}
                <TableCell className={cn(BUDGET.className, "max-w-[10rem] lg:max-w-[14rem] xl:max-w-[18rem]")}>
                  <span className="block truncate font-medium">{card.description}</span>
                  {card.merchant ? (
                    <span className="block truncate text-xs text-muted-foreground">{card.merchant.name}</span>
                  ) : null}
                </TableCell>
                <TableCell className={CARD.className}>
                  {pm ? (
                    <span className="flex items-center gap-2 whitespace-nowrap" title={paymentMethodLabel(pm)}>
                      <CardMark paymentMethod={pm} />
                      <span className="text-xs text-muted-foreground">•••• {pm.card?.last4}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={cn(AVAILABLE.className, "text-right whitespace-nowrap tabular-nums")}>
                  <span className="font-semibold">{formatAmount(card.amount.available, card.amount.currency)}</span>
                  {/* Only worth the second line once some of it is gone. */}
                  {spent ? (
                    <span className="block text-xs text-muted-foreground">
                      of {formatAmount(card.amount.total, card.amount.currency)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className={cn(EXPIRES.className, "whitespace-nowrap text-muted-foreground")}>
                  <span title={formatDateTime(card.expiresAt)}>{formatRelativeTime(card.expiresAt)}</span>
                </TableCell>
                <TableCell className={STATUS.className}>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell
                  className={cn(ACTIONS.className, "text-right")}
                  onClick={(e) => e.stopPropagation()}
                >
                  {needsVerification || revocable ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" disabled={working} aria-label={`Actions for ${card.description}`}>
                          {working ? <Spinner /> : <MoreHorizontal />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {needsVerification ? (
                          <DropdownMenuItem onSelect={() => setVerifying(card.orderIntentId)}>Verify with the network</DropdownMenuItem>
                        ) : null}
                        {needsVerification && revocable ? <DropdownMenuSeparator /> : null}
                        {revocable ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={async () => {
                              setBusy(card.orderIntentId);
                              try {
                                await onRevoke?.(card.orderIntentId);
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Revoke budget
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </TableCell>
              </TableRow>
              {isVerifying ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns} className="bg-muted/40">
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
                  </TableCell>
                </TableRow>
              ) : null}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
