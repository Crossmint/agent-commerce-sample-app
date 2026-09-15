"use client";

import * as React from "react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { errorMessage } from "../api/client.js";
import type { CheckoutView as CheckoutViewData } from "../api/types.js";
import { isTerminalCheckoutView, useCheckout } from "../hooks/use-checkout.js";
import { cn } from "../lib/utils.js";
import { Alert, AlertDescription, AlertTitle } from "./primitives/alert.js";
import { Badge, type BadgeProps } from "./primitives/badge.js";
import { Button } from "./primitives/button.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";
import { PendingActionForm } from "./pending-action-form.js";
import { Mascot } from "./mascot.js";

export interface CheckoutViewProps {
  checkoutId: string;
  /** Keep polling while the checkout runs. Default true. */
  poll?: boolean;
  /** Called once when the checkout reaches a terminal status. */
  onDone?: (view: CheckoutViewData) => void;
  className?: string;
  /** Height of the browser iframe. Default 560px. */
  frameHeight?: number;
}

function statusBadge(status: string): { label: string; variant: BadgeProps["variant"] } {
  switch (status) {
    case "succeeded":
      return { label: "Done", variant: "success" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelled", variant: "muted" };
    case "awaiting_user_action":
      return { label: "Needs your answer", variant: "warning" };
    case "running":
      return { label: "Buying", variant: "secondary" };
    default:
      return { label: status.replace(/_/g, " "), variant: "secondary" };
  }
}

function receiptTotal(receipt: Record<string, unknown> | undefined): string | undefined {
  const total = receipt?.total;
  if (!total) return undefined;
  if (typeof total === "string") return total;
  if (typeof total === "object" && total !== null && "amount" in total) {
    const t = total as { amount: string; currency?: string };
    return t.currency ? `${t.amount} ${t.currency}` : t.amount;
  }
  return undefined;
}

/**
 * Watches an Agent Checkout. Shows the live browser when Crossmint provides
 * one, asks the user any question the store asks, and ends with a receipt.
 * Payment questions never reach this component. The server answers them.
 */
export function CheckoutView({ checkoutId, poll = true, onDone, className, frameHeight = 560 }: CheckoutViewProps) {
  const { data, error, loading, refetch, submitAction, submitting } = useCheckout(checkoutId, { poll });
  const [actionError, setActionError] = React.useState<unknown>(undefined);

  const doneRef = React.useRef(false);
  React.useEffect(() => {
    if (data && isTerminalCheckoutView(data) && !doneRef.current) {
      doneRef.current = true;
      onDone?.(data);
    }
  }, [data, onDone]);

  if (loading && !data) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive" className={className}>
        <TriangleAlert />
        <AlertTitle>Could not load this checkout</AlertTitle>
        <AlertDescription>
          <p>{errorMessage(error)}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const badge = statusBadge(data.status);
  const terminal = isTerminalCheckoutView(data);
  const total = receiptTotal(data.receipt);
  const merchantOrderId = typeof data.receipt?.merchantOrderId === "string" ? data.receipt.merchantOrderId : undefined;

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Checkout</h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {!terminal ? <Spinner className="text-muted-foreground" /> : null}
        <span className="ml-auto font-mono text-xs text-muted-foreground">{data.id}</span>
      </div>

      {error ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Lost contact for a moment</AlertTitle>
          <AlertDescription>{errorMessage(error)} Still trying.</AlertDescription>
        </Alert>
      ) : null}

      {data.status === "succeeded" ? (
        <div className="goat-backdrop flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <Mascot size={88} />
          <div className="space-y-1">
            <p className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight">
              <CircleCheck className="size-6 text-success" /> Bought.
            </p>
            {total ? <p className="text-muted-foreground">Total {total}</p> : null}
            {merchantOrderId ? <p className="font-mono text-xs text-muted-foreground">Order {merchantOrderId}</p> : null}
          </div>
        </div>
      ) : null}

      {data.status === "failed" || data.status === "cancelled" ? (
        <Alert variant="destructive">
          <CircleX />
          <AlertTitle>{data.status === "cancelled" ? "Cancelled" : "Did not go through"}</AlertTitle>
          <AlertDescription>
            {data.failure?.message ?? data.failure?.reason?.replace(/_/g, " ") ?? "The store did not complete the order."}
          </AlertDescription>
        </Alert>
      ) : null}

      {!terminal && data.rendered ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          {actionError ? (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlert />
              <AlertTitle>Could not send your answer</AlertTitle>
              <AlertDescription>{errorMessage(actionError)}</AlertDescription>
            </Alert>
          ) : null}
          <PendingActionForm
            action={data.rendered}
            submitting={submitting}
            onSubmit={async (values) => {
              setActionError(undefined);
              try {
                await submitAction(data.rendered!.id, values);
              } catch (e) {
                setActionError(e);
              }
            }}
          />
        </div>
      ) : null}

      {!terminal && data.embedUrl ? (
        <div className="goat-window">
          <iframe
            title="Checkout browser"
            src={data.embedUrl}
            allow="clipboard-write"
            className="block w-full bg-background"
            style={{ height: frameHeight }}
          />
        </div>
      ) : null}

      {!terminal && !data.embedUrl && !data.rendered ? (
        <p className="text-sm text-muted-foreground">The agent is working on it. This page updates on its own.</p>
      ) : null}
    </div>
  );
}
