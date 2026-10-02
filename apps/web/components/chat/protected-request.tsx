"use client";

import { useCallback, useState } from "react";
import {
  AnswerProtectedRequest,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  cn,
  type ProtectedRequestOutcome,
} from "@agent-commerce/ui";
import { AGENT_COMPANY } from "@/components/brand";
import type { ProtectedRequestSummary } from "@/components/chat/parts";
import type { ProtectedInputOutcome } from "@/lib/chat/tools";
import { APPROVAL_DONE_LINGER_MS } from "./agent-card-approval";
import { SiteIcon } from "./checkout-site";
import { AgentBubble } from "./text";

/** "Password", "Password and one-time code": what the store asks for, in lower case, for a sentence. */
export function secretsPhrase(secrets: string[]): string {
  const words = secrets.map((s) => s.toLowerCase());
  if (words.length === 0) return "details";
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** What the agent asks when a store wants secrets, such as the password of the user's account there. */
export function protectedQuestion(request: Pick<ProtectedRequestSummary, "secrets" | "domain">): string {
  return `Can you enter your ${secretsPhrase(request.secrets)} for ${siteName(request.domain)}?`;
}

/** "www.amazon.com" → "amazon.com", for reading only. */
function siteName(domain: string): string {
  return domain.replace(/^www\./, "");
}

const OUTCOME_LABEL: Record<ProtectedInputOutcome["status"], string> = {
  submitted: "Sent",
  declined: "Skipped",
};

/**
 * A store's question with secrets in the thread, the same in every chat
 * frame, and laid out like an approval: the agent asks in its bubble, and
 * one small card sits under it, the store and what happens to the secrets,
 * with a button that opens the question, with Crossmint's protected fields,
 * in the frame's own sheet or dialog. Answered, the card says whether it was
 * sent.
 *
 * `request` comes from the watch that handed the request back, never from
 * the model.
 */
export function ProtectedRequestInThread({
  request,
  output,
  onEnter,
  bubbleClassName,
  buttonSize = "xl",
  className,
}: {
  request: ProtectedRequestSummary;
  output?: ProtectedInputOutcome;
  onEnter: () => void;
  bubbleClassName?: string;
  buttonSize?: "lg" | "xl";
  className?: string;
}) {
  const site = siteName(request.domain);
  return (
    <>
      <AgentBubble text={protectedQuestion(request)} className={bubbleClassName} />
      <div
        className={cn(
          "flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm leading-snug font-medium">
            <SiteIcon host={request.domain} size={16} />
            <span className="truncate">{request.question}</span>
          </p>
          <Badge variant={output?.status === "submitted" ? "success" : "muted"}>
            {output ? OUTCOME_LABEL[output.status] : "Pending"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Encrypted and only used on {site}. {AGENT_COMPANY} never sees it.
        </p>
        {output ? null : (
          <Button type="button" size={buttonSize} className="w-full" onClick={onEnter}>
            Enter {secretsPhrase(request.secrets)}
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * The desktop's protected request: the card in the thread, and its button
 * opens the question in a dialog. The model called
 * `await_protected_input({ checkoutId, requestId })` and the stream stopped;
 * once the user sent it (or skipped it), `onOutcome` hands back only that,
 * and the chat resubmits itself.
 */
export function ProtectedRequest({
  toolCallId,
  request,
  output,
  onOutcome,
}: {
  toolCallId: string;
  request: ProtectedRequestSummary;
  output?: ProtectedInputOutcome;
  onOutcome: (toolCallId: string, outcome: ProtectedInputOutcome) => void;
}) {
  const [open, setOpen] = useState(false);
  const handleDone = useCallback(
    (status: ProtectedRequestOutcome) => {
      onOutcome(toolCallId, { status });
      setTimeout(() => setOpen(false), APPROVAL_DONE_LINGER_MS);
    },
    [onOutcome, toolCallId],
  );

  return (
    <>
      <ProtectedRequestInThread
        request={request}
        output={output}
        buttonSize="lg"
        onEnter={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle className="sr-only">{request.question}</DialogTitle>
          {open ? (
            <AnswerProtectedRequest
              checkoutId={request.checkoutId}
              requestId={request.requestId}
              merchantDomain={request.domain}
              platformName={AGENT_COMPANY}
              onDone={handleDone}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
