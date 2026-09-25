"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  ApproveAgentCard,
  Badge,
  Button,
  CardMark,
  Dialog,
  DialogContent,
  DialogTitle,
  PAYMENT_STEP_ASK,
  Skeleton,
  cn,
  formatAmount,
  paymentMethodLabel,
  useAgentCardRequest,
  usePaymentMethods,
  type ApproveOutcome,
} from "@agent-commerce/ui";
import { PLATFORM_NAME } from "@/components/brand";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import { toApprovalOutcome } from "./parts";
import { AgentBubble } from "./text";

/** How long an ending stays on screen before its sheet or dialog goes away. */
export const APPROVAL_DONE_LINGER_MS = 800;

/** What the agent asks over a request: approve a budget, or choose how to pay a checkout. */
export function approvalQuestion(paying: boolean): string {
  return paying
    ? "How do you want to pay for this?"
    : "Can you approve this request to use your card?";
}

/**
 * An approval in the thread, the same in every chat frame: the agent asks in
 * its bubble, and the request sits under it as one small card. Waiting, the
 * card says what it is for, the limit and the store, with Review, which
 * opens the approval screen (the frame's own sheet or dialog). Settled, the
 * same card carries the outcome and the saved card behind it.
 */
export function ApprovalInThread({
  requestId,
  output,
  paying,
  onReview,
  bubbleClassName,
  buttonSize = "xl",
  className,
}: {
  requestId: string;
  /** Set once the user answered. */
  output?: ApprovalOutcome;
  /** A checkout's payment step: the user chooses how to pay for a total, not a budget. */
  paying: boolean;
  onReview: () => void;
  /** The frame's own bubble size. */
  bubbleClassName?: string;
  buttonSize?: "lg" | "xl";
  className?: string;
}) {
  return (
    <>
      <AgentBubble text={approvalQuestion(paying)} className={bubbleClassName} />
      {output ? (
        <AgentCardSummary requestId={requestId} outcome={output} className={className} />
      ) : (
        <RequestCard
          requestId={requestId}
          paying={paying}
          badge={<Badge variant="muted">Pending</Badge>}
          className={className}
          action={
            <Button type="button" size={buttonSize} className="w-full" onClick={onReview}>
              Review
            </Button>
          }
        />
      )}
    </>
  );
}

/**
 * The desktop's approval: the request in the thread, and Review opens the
 * app's own `<ApproveAgentCard>` in a dialog. The model called
 * `await_agent_card_approval({ requestId })` and the stream stopped; once the
 * request reaches a final state, `onOutcome` hands the outcome back as the
 * tool output and the chat resubmits itself.
 */
export function AgentCardApproval({
  toolCallId,
  requestId,
  output,
  paying,
  onOutcome,
}: {
  toolCallId: string;
  requestId: string;
  output?: ApprovalOutcome;
  paying: boolean;
  onOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
}) {
  const [open, setOpen] = useState(false);
  const handleDone = useCallback(
    (o: ApproveOutcome) => {
      onOutcome(toolCallId, toApprovalOutcome(o));
      // The ending shows for a moment before the dialog goes.
      setTimeout(() => setOpen(false), APPROVAL_DONE_LINGER_MS);
    },
    [onOutcome, toolCallId],
  );

  return (
    <>
      <ApprovalInThread
        requestId={requestId}
        output={output}
        paying={paying}
        buttonSize="lg"
        onReview={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle className="sr-only">Approve</DialogTitle>
          {open ? (
            <ApproveAgentCard
              requestId={requestId}
              variant="plain"
              platformName={PLATFORM_NAME}
              ask={paying ? PAYMENT_STEP_ASK : undefined}
              onDone={handleDone}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

const OUTCOME_LABEL: Record<ApprovalOutcome["status"], string> = {
  active: "Approved",
  denied: "Denied",
  expired: "Expired",
  failed: "Failed",
};

/**
 * An approval once it is settled: what the agent card is for, the outcome,
 * the limit, the saved card behind it, and the store when it is locked to one.
 */
export function AgentCardSummary({
  requestId,
  outcome,
  className,
}: {
  requestId: string;
  outcome: ApprovalOutcome;
  className?: string;
}) {
  const tone =
    outcome.status === "active" ? "success" : outcome.status === "denied" ? "destructive" : "muted";
  return (
    <RequestCard
      requestId={requestId}
      paying={false}
      withCard
      badge={<Badge variant={tone}>{OUTCOME_LABEL[outcome.status]}</Badge>}
      className={className}
    />
  );
}

/**
 * A request as one card: what it is for with its badge, then the limit (the
 * total, for a payment step), the saved card once one backs it, and the
 * store. Read once from the request, which holds all of it; the card's name
 * comes from the user's saved cards.
 */
function RequestCard({
  requestId,
  paying,
  withCard = false,
  badge,
  action,
  className,
}: {
  requestId: string;
  paying: boolean;
  /** Show the saved card behind the request, once there is one. */
  withCard?: boolean;
  badge: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  // No polling: the approval screen follows the request while it is open.
  const request = useAgentCardRequest(requestId, { pollMs: 0 });
  const req = request.data;
  const methods = usePaymentMethods({ enabled: withCard && Boolean(req?.paymentMethodId) });
  const card = withCard
    ? methods.data?.find((m) => m.paymentMethodId === req?.paymentMethodId)
    : undefined;

  return (
    <div
      className={cn(
        "flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {req ? (
          <p className="min-w-0 text-sm leading-snug font-medium text-balance">{req.description}</p>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
        {badge}
      </div>
      {req ? (
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{paying ? "Total" : "Limit"}</dt>
          <dd className="text-right font-medium tabular-nums">
            {formatAmount(req.amount.value, req.amount.currency)}
          </dd>
          {card ? (
            <>
              <dt className="text-muted-foreground">Card</dt>
              <dd className="flex items-center justify-end gap-2">
                <CardMark paymentMethod={card} />
                <span className="truncate">{paymentMethodLabel(card)}</span>
              </dd>
            </>
          ) : withCard && req.paymentMethodId ? (
            <>
              <dt className="text-muted-foreground">Card</dt>
              <dd className="flex justify-end">
                <Skeleton className="h-4 w-28" />
              </dd>
            </>
          ) : null}
          {req.merchant ? (
            <>
              <dt className="text-muted-foreground">Store</dt>
              <dd className="truncate text-right">{req.merchant.name}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
      {action}
    </div>
  );
}
