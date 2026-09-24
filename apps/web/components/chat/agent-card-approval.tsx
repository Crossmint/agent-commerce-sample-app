"use client";

import { useCallback } from "react";
import {
  ApproveAgentCard,
  Badge,
  CardMark,
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
import { toApprovalOutcome, type RequestSummary, type ToolError } from "./parts";
import { ToolCard, type ToolState } from "./tool-card";

/**
 * Inline approval, for the desktop chat. The model called
 * `await_agent_card_approval({ requestId })` and the stream stopped. This
 * renders the app's own `<ApproveAgentCard>` in the tool's slot. Once the
 * request reaches a final state, `onDone` hands the outcome back as the tool
 * output and the chat resubmits itself.
 */
export function AgentCardApproval({
  toolCallId,
  requestId,
  output,
  ask,
  onOutcome,
}: {
  toolCallId: string;
  requestId: string;
  /** Set once the user answered. Then the card shows the outcome, not the form. */
  output?: ApprovalOutcome;
  /** `PAYMENT_STEP_ASK` when a checkout is waiting on this. Default wording otherwise. */
  ask?: { title: string; sub: string };
  onOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
}) {
  const handleDone = useCallback(
    (o: ApproveOutcome) => onOutcome(toolCallId, toApprovalOutcome(o)),
    [onOutcome, toolCallId],
  );

  if (output) return <AgentCardSummary requestId={requestId} outcome={output} />;

  return (
    <div className="w-full max-w-lg">
      <ApproveAgentCard
        requestId={requestId}
        variant="card"
        platformName={PLATFORM_NAME}
        ask={ask}
        onDone={handleDone}
        className="max-w-none"
      />
    </div>
  );
}

const OUTCOME_LABEL: Record<ApprovalOutcome["status"], string> = {
  active: "Approved",
  denied: "Denied",
  expired: "Expired",
  failed: "Failed",
};

/**
 * An approval once it is settled: what the agent card is for, the limit, the
 * saved card behind it, and the store when it is locked to one. Read once
 * from the request, which holds all of it; the card's name comes from the
 * user's saved cards.
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
  // No polling: a settled request does not change.
  const request = useAgentCardRequest(requestId, { pollMs: 0 });
  const methods = usePaymentMethods({ enabled: Boolean(request.data?.paymentMethodId) });
  const req = request.data;
  const card = methods.data?.find((m) => m.paymentMethodId === req?.paymentMethodId);
  const tone =
    outcome.status === "active" ? "success" : outcome.status === "denied" ? "destructive" : "muted";

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
        <Badge variant={tone}>{OUTCOME_LABEL[outcome.status]}</Badge>
      </div>
      {req ? (
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Limit</dt>
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
          ) : req.paymentMethodId ? (
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
    </div>
  );
}

/** The `request_agent_card` result as a small card. */
export function AgentCardRequestCard({
  state,
  input,
  output,
  errorText,
}: {
  state: ToolState;
  input?: unknown;
  output?: RequestSummary | ToolError;
  errorText?: string;
}) {
  const failed = output && "error" in output ? output : undefined;
  const req = output && !("error" in output) ? output : undefined;
  return (
    <ToolCard
      title="Requesting an agent card"
      state={state}
      input={input}
      output={output}
      errorText={errorText ?? failed?.error}
      summary={
        req
          ? `${formatAmount(req.amount.value, req.amount.currency)} for ${req.description}`
          : undefined
      }
    />
  );
}
