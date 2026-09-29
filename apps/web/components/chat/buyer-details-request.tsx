"use client";

import { useCallback, useState } from "react";
import { UserRound } from "lucide-react";
import type { BuyerProfile } from "@agent-commerce/core";
import { Badge, Button, cn } from "@agent-commerce/ui";
import {
  BUYER_DETAILS_NOTE,
  BUYER_DETAILS_TITLE,
  BuyerDetailsForm,
  BuyerDetailsSheet,
} from "@/components/buyer-details";
import type { BuyerDetailsOutcome } from "@/lib/chat/tools";
import { APPROVAL_DONE_LINGER_MS } from "./agent-card-approval";
import { AgentBubble } from "./text";

/** What the agent says when it asks for the details. */
export const BUYER_DETAILS_QUESTION =
  "I need a few details for your orders. Add them once, and I use them at every checkout.";

export { BUYER_DETAILS_NOTE, BUYER_DETAILS_TITLE };

/**
 * Asking for the details in the thread, the same in every chat frame: the
 * agent asks in its bubble, and one small card under it says what is
 * needed. Add details opens the form in the frame's own sheet; Not now
 * answers `skipped`, and the store asks for what it needs.
 */
export function BuyerDetailsInThread({
  output,
  onOpen,
  onSkip,
  bubbleClassName,
  buttonSize = "xl",
  className,
}: {
  output?: BuyerDetailsOutcome;
  onOpen: () => void;
  onSkip: () => void;
  bubbleClassName?: string;
  buttonSize?: "lg" | "xl";
  className?: string;
}) {
  const saved = output?.status === "saved";
  return (
    <>
      <AgentBubble text={BUYER_DETAILS_QUESTION} className={bubbleClassName} />
      <div
        className={cn(
          "flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm leading-snug font-medium">
            <UserRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{BUYER_DETAILS_TITLE}</span>
          </p>
          <Badge variant={saved ? "success" : "muted"}>
            {saved ? "Saved" : output ? "Skipped" : "Pending"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {saved
            ? "Saved. You can change them under Buyer details."
            : "Name, email, phone and shipping address, once."}
        </p>
        {output ? null : (
          <div className="flex flex-col gap-2">
            <Button type="button" size={buttonSize} className="w-full" onClick={onOpen}>
              Add details
            </Button>
            <Button
              type="button"
              size={buttonSize}
              variant="secondary"
              className="w-full"
              onClick={onSkip}
            >
              Not now
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The form in a sheet, for the frame that opens it: for the agent's
 * question, or to change the details from the account. Saving hands back
 * `saved`. Closing the sheet answers nothing: the card in the thread keeps
 * Add details and Not now.
 */
export function BuyerDetailsSheetBody({
  email,
  initial,
  submitLabel = "Save and continue",
  onOutcome,
}: {
  email?: string;
  /** The saved details, when the user changes them. */
  initial?: BuyerProfile;
  submitLabel?: string;
  onOutcome: (outcome: BuyerDetailsOutcome) => void;
}) {
  return (
    <BuyerDetailsForm
      initial={initial}
      email={email}
      submitLabel={submitLabel}
      onSaved={() => onOutcome({ status: "saved" })}
    />
  );
}

/**
 * The desktop's version: the card in the thread, and the form in a side
 * sheet that Add details opens. Closing the sheet leaves the question
 * open; Add details opens it again.
 */
export function BuyerDetailsRequest({
  toolCallId,
  output,
  email,
  onOutcome,
}: {
  toolCallId: string;
  output?: BuyerDetailsOutcome;
  email?: string;
  onOutcome: (toolCallId: string, outcome: BuyerDetailsOutcome) => void;
}) {
  const [open, setOpen] = useState(false);
  const handle = useCallback(
    (outcome: BuyerDetailsOutcome) => {
      onOutcome(toolCallId, outcome);
      setTimeout(() => setOpen(false), outcome.status === "saved" ? APPROVAL_DONE_LINGER_MS : 0);
    },
    [onOutcome, toolCallId],
  );

  return (
    <>
      <BuyerDetailsInThread
        output={output}
        buttonSize="lg"
        onOpen={() => setOpen(true)}
        onSkip={() => handle({ status: "skipped" })}
      />
      <BuyerDetailsSheet
        open={open}
        onOpenChange={setOpen}
        email={email}
        submitLabel="Save and continue"
        onSaved={() => handle({ status: "saved" })}
      />
    </>
  );
}
