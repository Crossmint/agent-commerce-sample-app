"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ApproveAgentCard, Badge, Button, formatAmount, type ApproveOutcome } from "@goat-wallet/ui";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import { ToolCard, type ToolState } from "./tool-card";

/**
 * Inline approval. The model called `await_agent_card_approval({ requestId })`
 * and the stream stopped. This renders the wallet's own `<ApproveAgentCard>` in
 * the tool's slot. Once the request reaches a final state, `onDone` hands the
 * outcome back as the tool output and the chat resubmits itself.
 */
export function AgentCardApproval({
  toolCallId,
  requestId,
  output,
  onOutcome,
}: {
  toolCallId: string;
  requestId: string;
  /** Set once the user answered. Then the card shows the outcome, not the form. */
  output?: ApprovalOutcome;
  onOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
}) {
  const handleDone = useCallback(
    (o: ApproveOutcome) => onOutcome(toolCallId, { status: o.status, agentCardId: o.agentCard?.orderIntentId ?? o.request.agentCardId }),
    [onOutcome, toolCallId],
  );

  if (output) {
    const label =
      output.status === "active"
        ? "Approved. The agent card is active."
        : output.status === "denied"
          ? "Denied."
          : output.status === "expired"
            ? "The request expired."
            : "The card could not be set up.";
    return (
      <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        <Badge variant={output.status === "active" ? "success" : output.status === "denied" ? "destructive" : "muted"}>
          {output.status}
        </Badge>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {output.agentCardId ? <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{output.agentCardId.slice(0, 12)}…</span> : null}
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <ApproveAgentCard requestId={requestId} onDone={handleDone} className="max-w-none rounded-2xl p-5 sm:p-6" />
    </div>
  );
}

export interface RequestSummary {
  requestId: string;
  approvalUrl: string;
  status: string;
  amount: { value: string; currency: string };
  description: string;
  merchant?: { name: string; url: string };
  expiresAt: string;
}

/** The `request_agent_card` result as a small card. */
export function AgentCardRequestCard({
  state,
  input,
  output,
  errorText,
  showApprovalLink,
}: {
  state: ToolState;
  input?: unknown;
  output?: RequestSummary | { error: string; code: string };
  errorText?: string;
  /** True when no approval step followed in this message: give the user the wallet link instead. */
  showApprovalLink: boolean;
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
      summary={req ? `${formatAmount(req.amount.value, req.amount.currency)} for ${req.description}` : undefined}
    >
      {req && showApprovalLink ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Approve it from your wallet.</span>
          <Button asChild size="sm" variant="outline">
            <Link href={req.approvalUrl.replace(/^https?:\/\/[^/]+/, "")}>
              Open approval <ArrowUpRight />
            </Link>
          </Button>
        </div>
      ) : null}
    </ToolCard>
  );
}
