"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { asksPasswordInForm } from "@agent-commerce/core";
import { errorMessage } from "../api/client.js";
import type { CheckoutView as CheckoutViewData } from "../api/types.js";
import { isTerminalCheckoutView, useCheckout } from "../hooks/use-checkout.js";
import {
  CHECKOUT_FALLBACK_POLL_MS,
  checkoutChanged,
  useCheckoutMessages,
} from "../hooks/use-checkout-messages.js";
import { cn } from "../lib/utils.js";
import { Alert, AlertDescription, AlertTitle } from "./primitives/alert.js";
import { Badge, type BadgeProps } from "./primitives/badge.js";
import { Button } from "./primitives/button.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";
import { ApproveAgentCard, PAYMENT_STEP_ASK } from "./approve-agent-card.js";
import { CheckoutSteps, checkoutSteps } from "./checkout-steps.js";
import { AnswerProtectedRequest } from "./answer-protected-request.js";
import { PendingActionForm } from "./pending-action-form.js";

export interface CheckoutViewProps {
  checkoutId: string;
  /** Keep polling while the checkout runs. Default true. */
  poll?: boolean;
  /** Called once when the checkout reaches a terminal status. */
  onDone?: (view: CheckoutViewData) => void;
  className?: string;
  /**
   * The name the card network shows while the user saves a card at the
   * payment step. It is the platform saving it, not the agent asking.
   */
  platformName?: string;
}

function statusBadge(status: string): { label: string; variant: BadgeProps["variant"] } {
  switch (status) {
    case "succeeded":
      return { label: "Done", variant: "success" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    case "blocked":
      return { label: "Stopped", variant: "destructive" };
    case "cancelled":
      return { label: "Cancelled", variant: "muted" };
    case "awaiting_input":
      return { label: "Needs your answer", variant: "warning" };
    case "queued":
      return { label: "Starting", variant: "secondary" };
    case "running":
      return { label: "Buying", variant: "secondary" };
    default:
      return { label: status.replace(/_/g, " "), variant: "secondary" };
  }
}

function receiptTotal(receipt: CheckoutViewData["receipt"]): string | undefined {
  return receipt ? `${receipt.total.amount} ${receipt.total.currency}` : undefined;
}

const PANEL = "rounded-2xl bg-card p-6 ring-1 ring-foreground/10";

/**
 * Watches an Agent Checkout on a page of its own. Lists what the agent does
 * as steps that tick off, asks the user any question the store asks, and
 * ends with a receipt. The agent's browser is never shown: the steps say
 * what it does there.
 *
 * The store's card form never reaches this component. When the run wants
 * paying, the view carries a `paymentRequest` instead and the user picks one
 * of their saved payment methods here; that mints an agent card scoped to the
 * purchase, and the server answers the store from it.
 */
export function CheckoutView({
  checkoutId,
  poll = true,
  onDone,
  className,
  platformName,
}: CheckoutViewProps) {
  const { data, error, loading, refetch, submitAction, decline, cancel, submitting } = useCheckout(
    checkoutId,
    { poll, pollMs: CHECKOUT_FALLBACK_POLL_MS },
  );
  // The stream says when the run moves; read the checkout then, not on a timer.
  const messages = useCheckoutMessages(checkoutId, {
    live: poll && Boolean(data) && !isTerminalCheckoutView(data),
    onEvent: (event) => {
      if (checkoutChanged(event)) void refetch();
    },
  });
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
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[160px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <Problem title="Could not load this checkout" message={errorMessage(error)} />
        <Button
          type="button"
          size="xl"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const badge = statusBadge(data.status);
  const terminal = isTerminalCheckoutView(data);
  const total = receiptTotal(data.receipt);
  const merchantOrderId = data.receipt?.merchantOrderId;
  const summary = data.result?.summary;
  const stopped =
    data.status === "failed" || data.status === "blocked" || data.status === "cancelled";
  const steps = checkoutSteps(messages.data ?? [], data);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-foreground">
          Checkout
        </h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {!terminal ? <Spinner className="text-muted-foreground" /> : null}
        <span className="ml-auto font-mono text-xs text-muted-foreground">{data.id}</span>
      </div>

      {steps.length ? <CheckoutSteps steps={steps} className={PANEL} /> : null}

      {error ? (
        <Alert variant="warning">
          <AlertCircle />
          <AlertTitle>Lost contact for a moment</AlertTitle>
          <AlertDescription>{errorMessage(error)} Still trying.</AlertDescription>
        </Alert>
      ) : null}

      {/* The ending the onramp sample app gives a finished deposit: the
          figure is the news, so it is the big blue thing. */}
      {data.status === "succeeded" ? (
        <div className={cn("flex flex-col gap-2", PANEL)}>
          <p className="text-[28px] leading-[1.2] font-medium tracking-[-0.02em]">Bought.</p>
          {total ? (
            <p className="font-display text-4xl font-semibold tracking-tight text-primary tabular-nums">
              {total}
            </p>
          ) : null}
          {summary ? <p className="text-base text-muted-foreground">{summary}</p> : null}
          {merchantOrderId ? (
            <p className="font-mono text-xs text-muted-foreground">Order {merchantOrderId}</p>
          ) : null}
        </div>
      ) : null}

      {stopped ? (
        <Problem
          title={
            data.status === "cancelled"
              ? "Cancelled"
              : data.status === "blocked"
                ? "Stopped before buying"
                : "Did not go through"
          }
          message={
            data.failure?.message ??
            summary ??
            data.failure?.reason?.replace(/[_.]/g, " ") ??
            "The store did not complete the order."
          }
        />
      ) : null}

      {!terminal && data.paymentRequest ? (
        <div className={PANEL}>
          <ApproveAgentCard
            requestId={data.paymentRequest.requestId}
            variant="plain"
            platformName={platformName}
            ask={PAYMENT_STEP_ASK}
            // Once the card is live the server can pay, but only on the next
            // read of the run. Ask for one rather than waiting out the poll.
            onDone={() => {
              void refetch();
              void messages.refetch();
            }}
          />
        </div>
      ) : null}

      {/* A form with secrets: each one in Crossmint's protected field, the rest as usual. */}
      {!terminal && data.protectedRequest && data.rendered ? (
        <div className={PANEL}>
          <AnswerProtectedRequest
            key={data.rendered.id}
            checkoutId={checkoutId}
            requestId={data.rendered.id}
            merchantDomain={data.protectedRequest.merchantDomain}
            platformName={platformName}
            onDone={() => {
              void refetch();
              void messages.refetch();
            }}
          />
        </div>
      ) : null}

      {/* A password in a plain field: never filled in here, only skipped. */}
      {!terminal && data.pendingUserAction && asksPasswordInForm(data.pendingUserAction) ? (
        <div className={PANEL}>
          <Problem
            title="The store asks for your password"
            message="It asks in a way this app does not accept: a password is only ever typed into a secure field. Skip it, and the agent carries on without signing in, or tries a guest checkout."
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting}
            className="mt-4"
            onClick={async () => {
              setActionError(undefined);
              try {
                await decline(data.pendingUserAction!.id);
                void messages.refetch();
              } catch (e) {
                setActionError(e);
              }
            }}
          >
            Skip this question
          </Button>
        </div>
      ) : null}

      {!terminal && data.rendered && !data.protectedRequest ? (
        <div className={PANEL}>
          {actionError ? (
            <Problem
              className="mb-4"
              title="Could not send your answer"
              message={errorMessage(actionError)}
            />
          ) : null}
          <PendingActionForm
            action={data.rendered}
            submitting={submitting}
            onSubmit={async (values) => {
              setActionError(undefined);
              try {
                await submitAction(data.rendered!.id, values);
                // Tick the answered question now, not on the next poll.
                void messages.refetch();
              } catch (e) {
                setActionError(e);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            className="mt-2 text-muted-foreground"
            onClick={async () => {
              setActionError(undefined);
              try {
                await decline(data.rendered!.id);
                void messages.refetch();
              } catch (e) {
                setActionError(e);
              }
            }}
          >
            Skip this question
          </Button>
        </div>
      ) : null}

      {!terminal ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={submitting}
          className="self-start"
          onClick={async () => {
            setActionError(undefined);
            try {
              await cancel();
            } catch (e) {
              setActionError(e);
            }
          }}
        >
          Cancel checkout
        </Button>
      ) : null}
    </div>
  );
}

/** A fault, said plainly: the icon, a title, one line. */
function Problem({
  title,
  message,
  className,
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex items-start gap-3", className)}>
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
