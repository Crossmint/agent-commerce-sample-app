"use client";

import { useCallback } from "react";
import { ApproveAgentCard, Badge, formatAmount, type ApproveOutcome } from "@agent-commerce/ui";
import { PLATFORM_NAME } from "@/components/brand";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import { approvalLabel, toApprovalOutcome, type RequestSummary, type ToolError } from "./parts";
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

  if (output) return <ApprovalResult outcome={output} />;

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

/** What the user decided, as one quiet row. */
export function ApprovalResult({
  outcome,
  className,
}: {
  outcome: ApprovalOutcome;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "flex w-full max-w-lg items-center gap-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10"
      }
    >
      <Badge
        variant={
          outcome.status === "active"
            ? "success"
            : outcome.status === "denied"
              ? "destructive"
              : "muted"
        }
      >
        {outcome.status}
      </Badge>
      <span className="min-w-0 flex-1 truncate">{approvalLabel(outcome)}</span>
      {outcome.agentCardId ? (
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
          {outcome.agentCardId.slice(0, 12)}…
        </span>
      ) : null}
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
