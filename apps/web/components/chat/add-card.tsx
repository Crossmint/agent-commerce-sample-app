"use client";

import { useCallback, useState } from "react";
import { CreditCard } from "lucide-react";
import {
  Badge,
  Button,
  CardMark,
  Dialog,
  DialogContent,
  DialogTitle,
  SaveCard,
  cn,
  paymentMethodLabel,
  usePaymentMethods,
  type SaveCardResult,
} from "@agent-commerce/ui";
import { AGENT_COMPANY } from "@/components/brand";
import type { SavedCardOutcome } from "@/lib/chat/tools";
import { APPROVAL_DONE_LINGER_MS } from "./agent-card-approval";
import { AgentBubble } from "./text";

/** What the agent asks when the user adds a card. */
export const ADD_CARD_QUESTION = "Add a card to get started.";

/** The tool output for a saved card: which card, never its number. */
export function savedCardOutcome(result: SaveCardResult): SavedCardOutcome {
  const pm = result.paymentMethod;
  return {
    status: "saved",
    card: {
      paymentMethodId: pm.paymentMethodId,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "",
    },
  };
}

/**
 * Adding a card in the thread, the same in every chat frame and laid out
 * like an approval: the agent asks in its bubble, and one small card sits
 * under it with Add card, which opens Crossmint's card form in the frame's
 * own sheet or dialog. Saved, the card shows which one it was.
 */
export function AddCardInThread({
  output,
  onAdd,
  bubbleClassName,
  buttonSize = "xl",
  className,
}: {
  output?: SavedCardOutcome;
  onAdd: () => void;
  bubbleClassName?: string;
  buttonSize?: "lg" | "xl";
  className?: string;
}) {
  const saved = output?.status === "saved" ? output.card : undefined;
  const methods = usePaymentMethods({ enabled: Boolean(saved) });
  const pm = saved
    ? methods.data?.find((m) => m.paymentMethodId === saved.paymentMethodId)
    : undefined;

  return (
    <>
      <AgentBubble text={ADD_CARD_QUESTION} className={bubbleClassName} />
      <div
        className={cn(
          "flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm leading-snug font-medium">
            {pm ? (
              <CardMark paymentMethod={pm} />
            ) : (
              <CreditCard aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">
              {pm ? paymentMethodLabel(pm) : saved ? `Card •••• ${saved.last4}` : "Add a card"}
            </span>
          </p>
          <Badge variant={saved ? "success" : "muted"}>
            {saved ? "Saved" : output ? "Skipped" : "Pending"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Encrypted and stored by Crossmint. {AGENT_COMPANY} never sees the number.
        </p>
        {output ? null : (
          <Button type="button" size={buttonSize} className="w-full" onClick={onAdd}>
            Add card
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * The desktop's version: the card in the thread, and Add card opens the form
 * in a dialog. Once the card is saved, `onOutcome` hands back which one, and
 * the chat resubmits itself.
 */
export function AddCard({
  toolCallId,
  output,
  onOutcome,
}: {
  toolCallId: string;
  output?: SavedCardOutcome;
  onOutcome: (toolCallId: string, outcome: SavedCardOutcome) => void;
}) {
  const [open, setOpen] = useState(false);
  const handleSaved = useCallback(
    (result: SaveCardResult) => {
      onOutcome(toolCallId, savedCardOutcome(result));
      setTimeout(() => setOpen(false), APPROVAL_DONE_LINGER_MS);
    },
    [onOutcome, toolCallId],
  );

  return (
    <>
      <AddCardInThread output={output} buttonSize="lg" onAdd={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle>Add a card</DialogTitle>
          {open ? <SaveCard showResult={false} onSaved={handleSaved} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
