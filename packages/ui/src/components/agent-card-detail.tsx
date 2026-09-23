"use client";

import * as React from "react";
import {
  needsCvcRecollection,
  pendingVerificationRails,
  type AgentCard,
  type PaymentMethod,
} from "@agent-commerce/core";
import { cn } from "../lib/utils.js";
import { formatAmount, formatDateTime, formatRelativeTime, paymentMethodLabel } from "../lib/format.js";
import { useIsMobile } from "../hooks/use-media-query.js";
import { useReveals } from "../hooks/use-reveals.js";
import { AgentCardArt } from "./agent-card-art.js";
import { RailBadge } from "./agent-card-list.js";
import { CardMark } from "./card-mark.js";
import { Button } from "./primitives/button.js";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./primitives/sheet.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./primitives/table.js";

export interface AgentCardDetailProps {
  /** The budget to show. Null closes the panel. */
  agentCard: AgentCard | null;
  onOpenChange: (open: boolean) => void;
  /** The user's saved cards, to name the one behind this budget. */
  paymentMethods?: PaymentMethod[];
  onRevoke?: (agentCardId: string) => void | Promise<void>;
  onVerify?: (agentCardId: string) => void;
  /** Sends the user to the security-code field for the card behind this budget. */
  onRecollectCvc?: (agentCardId: string) => void;
}

/**
 * One budget in full: the card itself, the saved card behind it, the facts a
 * list has no room for, and every credential minted from it.
 *
 * A panel down the right on a desktop, a bottom sheet on a phone, the same
 * Radix dialog either way, as the card form does. Its transactions are asked
 * for only while it is open, and only for this budget, so opening a panel
 * costs one narrow query rather than a slice of the whole list.
 */
export function AgentCardDetail({
  agentCard,
  onOpenChange,
  paymentMethods,
  onRevoke,
  onVerify,
  onRecollectCvc,
}: AgentCardDetailProps) {
  const isMobile = useIsMobile();
  const [busy, setBusy] = React.useState(false);
  const open = agentCard !== null;
  const pm = paymentMethods?.find((p) => p.paymentMethodId === agentCard?.paymentMethodId);

  const body = agentCard ? (
    <AgentCardDetailBody
      agentCard={agentCard}
      paymentMethod={pm}
      busy={busy}
      onRevoke={
        onRevoke && agentCard.status === "active"
          ? async () => {
              setBusy(true);
              try {
                await onRevoke(agentCard.orderIntentId);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }
          : undefined
      }
      onVerify={
        onVerify && agentCard.status === "active" && pendingVerificationRails(agentCard).length > 0
          ? () => {
              onOpenChange(false);
              onVerify(agentCard.orderIntentId);
            }
          : undefined
      }
      // The field belongs where the budgets are listed, so the panel closes
      // behind it: one card can back several rows, and typing the code once
      // brings all of them back.
      onRecollectCvc={
        onRecollectCvc && agentCard.status === "active" && needsCvcRecollection(agentCard)
          ? () => {
              onOpenChange(false);
              onRecollectCvc(agentCard.orderIntentId);
            }
          : undefined
      }
    />
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn("gap-0 overflow-y-auto", isMobile ? "max-h-[92svh]" : "w-full sm:max-w-lg")}
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{agentCard?.description ?? "Agent card"}</SheetTitle>
          <SheetDescription>
            {agentCard ? `Approved for ${agentCard.merchant?.name ?? "any merchant"}.` : null}
          </SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}

export interface AgentCardDetailBodyProps {
  agentCard: AgentCard;
  paymentMethod?: PaymentMethod;
  busy: boolean;
  onRevoke?: () => void;
  onVerify?: () => void;
  onRecollectCvc?: () => void;
}

/**
 * The detail on its own, with no surface around it, for a host that already
 * has one — the phone on /app puts it in its own panel rather than a Radix
 * sheet, which would portal out of the phone frame.
 */
export function AgentCardDetailBody({
  agentCard,
  paymentMethod,
  busy,
  onRevoke,
  onVerify,
  onRecollectCvc,
}: AgentCardDetailBodyProps) {
  return (
    <div className="flex flex-col gap-6">
      <AgentCardArt agentCard={agentCard} paymentMethod={paymentMethod} />

      {onVerify || onRecollectCvc || onRevoke ? (
        <div className="flex flex-wrap gap-2">
          {onVerify ? (
            <Button type="button" size="sm" onClick={onVerify}>
              Verify with the network
            </Button>
          ) : null}
          {onRecollectCvc ? (
            <Button type="button" size="sm" onClick={onRecollectCvc}>
              Enter the security code
            </Button>
          ) : null}
          {onRevoke ? (
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onRevoke}>
              Revoke budget
            </Button>
          ) : null}
        </div>
      ) : null}

      <Block title="Backed by">
        {paymentMethod ? (
          <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <CardMark paymentMethod={paymentMethod} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{paymentMethodLabel(paymentMethod)}</p>
              {paymentMethod.card?.expiration ? (
                <p className="text-xs text-muted-foreground">
                  Expires {paymentMethod.card.expiration.month}/{paymentMethod.card.expiration.year}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The card behind this budget is not in your saved cards any more.
          </p>
        )}
      </Block>

      <Block title="Details">
        <dl className="flex flex-col rounded-2xl border border-border px-5">
          <Row label="Budget">
            {formatAmount(agentCard.amount.total, agentCard.amount.currency)}
          </Row>
          <Row label="Left">{formatAmount(agentCard.amount.available, agentCard.amount.currency)}</Row>
          <Row label="Reserved">{formatAmount(agentCard.amount.reserved, agentCard.amount.currency)}</Row>
          <Row label="Spent">{formatAmount(agentCard.amount.spent, agentCard.amount.currency)}</Row>
          <Row label="Merchant">{agentCard.merchant?.name ?? "Any"}</Row>
          <Row label="Expires">
            <span title={formatDateTime(agentCard.expiresAt)}>{formatRelativeTime(agentCard.expiresAt)}</span>
          </Row>
          <Row label="Rails">
            <span className="flex flex-wrap justify-end gap-1.5">
              {agentCard.rails.map((r) => (
                <RailBadge key={`${r.rail}-${"provider" in r ? r.provider : ""}`} rail={r} />
              ))}
            </span>
          </Row>
          <Row label="Card id">
            <span className="font-mono text-xs break-all">{agentCard.orderIntentId}</span>
          </Row>
        </dl>
      </Block>

      <Block title="Transactions">
        <RevealTable agentCardId={agentCard.orderIntentId} />
      </Block>
    </div>
  );
}

/** Every credential minted from this one budget. */
function RevealTable({ agentCardId }: { agentCardId: string }) {
  const reveals = useReveals({ agentCardId });
  const rows = reveals.data;

  if (reveals.loading && !rows) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
        Nothing minted from this budget yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Merchant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              <span title={formatDateTime(r.createdAt)}>{formatRelativeTime(r.createdAt)}</span>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">
              <span className="font-medium">{formatAmount(r.amount.value, r.amount.currency)}</span>
              {r.enforced === false ? <span className="block text-xs text-warning">not enforced</span> : null}
            </TableCell>
            <TableCell className="max-w-[10rem]">
              <span className="block truncate text-muted-foreground">{r.merchant?.name ?? "—"}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

/** One line of the summary list, as on the onramp order preview. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-3.5 last:border-0">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}
