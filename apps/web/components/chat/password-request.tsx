"use client";

import { useCallback, useState } from "react";
import {
  AnswerPasswordRequest,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  cn,
  type PasswordRequestOutcome,
} from "@agent-commerce/ui";
import type { ProtectedInputOutcome } from "@/lib/chat/tools";
import { APPROVAL_DONE_LINGER_MS } from "./agent-card-approval";
import { SiteIcon } from "./checkout-site";
import { AgentBubble } from "./text";

/** What the agent asks when a store wants the password of the user's account there. */
export function passwordQuestion(domain: string): string {
  return `${domain} asks you to sign in to continue. Can you enter your password?`;
}

const OUTCOME_LABEL: Record<ProtectedInputOutcome["status"], string> = {
  submitted: "Sent",
  declined: "Skipped",
};

/**
 * A store's password request in the thread, the same in every chat frame,
 * and laid out like an approval: the agent asks in its bubble, and one small
 * card sits under it, the store and what happens to the password, with
 * Enter password, which opens Crossmint's protected field in the frame's own
 * sheet or dialog. Answered, the card says whether it was sent.
 *
 * `domain` comes from the checkout (the watch that handed the request back),
 * never from the model: the password is bound to it.
 */
export function PasswordInThread({
  domain,
  output,
  onEnter,
  bubbleClassName,
  buttonSize = "xl",
  className,
}: {
  domain: string;
  output?: ProtectedInputOutcome;
  onEnter: () => void;
  bubbleClassName?: string;
  buttonSize?: "lg" | "xl";
  className?: string;
}) {
  return (
    <>
      <AgentBubble text={passwordQuestion(domain)} className={bubbleClassName} />
      <div
        className={cn(
          "flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm leading-snug font-medium">
            <SiteIcon host={domain} size={16} />
            <span className="truncate">Sign in to {domain}</span>
          </p>
          <Badge variant={output?.status === "submitted" ? "success" : "muted"}>
            {output ? OUTCOME_LABEL[output.status] : "Pending"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Your password goes straight to Crossmint. Neither this app nor the agent sees it.
        </p>
        {output ? null : (
          <Button type="button" size={buttonSize} className="w-full" onClick={onEnter}>
            Enter password
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * The desktop's password request: the card in the thread, and Enter password
 * opens the field in a dialog. The model called
 * `await_protected_input({ checkoutId, requestId })` and the stream stopped;
 * once the user sent the password (or skipped it), `onOutcome` hands back
 * only that, and the chat resubmits itself.
 */
export function PasswordRequest({
  toolCallId,
  checkoutId,
  requestId,
  domain,
  output,
  onOutcome,
}: {
  toolCallId: string;
  checkoutId: string;
  requestId: string;
  domain: string;
  output?: ProtectedInputOutcome;
  onOutcome: (toolCallId: string, outcome: ProtectedInputOutcome) => void;
}) {
  const [open, setOpen] = useState(false);
  const handleDone = useCallback(
    (status: PasswordRequestOutcome) => {
      onOutcome(toolCallId, { status });
      setTimeout(() => setOpen(false), APPROVAL_DONE_LINGER_MS);
    },
    [onOutcome, toolCallId],
  );

  return (
    <>
      <PasswordInThread
        domain={domain}
        output={output}
        buttonSize="lg"
        onEnter={() => setOpen(true)}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle className="sr-only">Sign in to {domain}</DialogTitle>
          {open ? (
            <AnswerPasswordRequest
              checkoutId={checkoutId}
              requestId={requestId}
              merchantDomain={domain}
              onDone={handleDone}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
