"use client";

import * as React from "react";
import { newMessageId } from "@agent-commerce/core";
import { AlertCircle, Lock } from "lucide-react";
import { AgentCommerceApiError, errorMessage } from "../api/client.js";
import type { CheckoutView } from "../api/types.js";
import { useCheckout } from "../hooks/use-checkout.js";
import { cn } from "../lib/utils.js";
import { useAgentCommerce } from "../provider.js";
import { PendingActionForm, type FormAnswers } from "./pending-action-form.js";
import { Button } from "./primitives/button.js";
import { Skeleton } from "./primitives/skeleton.js";

export type ProtectedRequestOutcome = "submitted" | "declined";

export interface AnswerProtectedRequestProps {
  checkoutId: string;
  /** The open request with protected fields: `protectedRequest.requestId` of the checkout's view. */
  requestId: string;
  /** The store the checkout runs on, for the reassurance: "shop.example.com". Default the checkout's own. */
  merchantDomain?: string;
  /** The heading is left to a host that asks in its own words. Default true. */
  showHeading?: boolean;
  /** Who cannot see the secrets, for the reassurance under the heading. Default "This app". */
  platformName?: string;
  /** Fires once the run has the answer, with the view the server returned. */
  onDone?: (outcome: ProtectedRequestOutcome, view?: CheckoutView) => void;
  className?: string;
}

/**
 * A store's question with protected fields, such as a sign-in, answered: the
 * whole form, read from the checkout, with each secret in Crossmint's
 * protected field. On submit the
 * secrets go to Crossmint's vault, and the run is answered once, with the
 * other fields and the ids. "Not now" declines the request instead, and the
 * store's agent carries on without it, or asks another way.
 *
 * When the answer may have reached the run but no reply came back, sending
 * the same answers again reuses the same message id, so the run applies it
 * once.
 */
export function AnswerProtectedRequest({
  checkoutId,
  requestId,
  merchantDomain,
  showHeading = true,
  platformName = "This app",
  onDone,
  className,
}: AnswerProtectedRequestProps) {
  const { api } = useAgentCommerce();
  // The fields come from the checkout, never from the agent that asked.
  const checkout = useCheckout(checkoutId, { poll: false });
  const action = checkout.data?.rendered?.id === requestId ? checkout.data.rendered : undefined;
  const [state, setState] = React.useState<"answering" | "sending" | "sent" | "declined">(
    "answering",
  );
  const [failure, setFailure] = React.useState<unknown>(undefined);
  // The answer whose reply was lost: the same answers go again under the same id.
  const unconfirmed = React.useRef<{ messageId: string; body: string } | undefined>(undefined);

  const send = async (values: FormAnswers) => {
    const body = JSON.stringify(values);
    const messageId =
      unconfirmed.current?.body === body ? unconfirmed.current.messageId : newMessageId();
    unconfirmed.current = { messageId, body };
    setState("sending");
    setFailure(undefined);
    try {
      const view = await api.answerCheckout(checkoutId, { requestId, values, messageId });
      unconfirmed.current = undefined;
      setState("sent");
      onDone?.("submitted", view);
    } catch (e) {
      // A refusal is definite: the next answer is a new message.
      if (e instanceof AgentCommerceApiError && e.status < 500) unconfirmed.current = undefined;
      setFailure(e);
      setState("answering");
    }
  };

  const decline = async () => {
    setState("sending");
    setFailure(undefined);
    try {
      const view = await api.answerCheckout(checkoutId, { requestId, action: "decline" });
      setState("declined");
      onDone?.("declined", view);
    } catch (e) {
      setFailure(e);
      setState("answering");
    }
  };

  const domain = merchantDomain ?? checkout.data?.protectedRequest?.merchantDomain;
  const site = domain ? siteName(domain) : "the store";
  if (state === "sent" || state === "declined") {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {state === "sent"
          ? `Sent. The agent carries on at ${site}.`
          : "Skipped. The agent carries on without it."}
      </p>
    );
  }
  if (checkout.loading) return <Skeleton className={cn("h-48", className)} />;
  if (!action) {
    return (
      <Problem
        className={className}
        title="This question is no longer open"
        message={
          checkout.error
            ? errorMessage(checkout.error)
            : "The store has moved on. The agent carries on from where it is."
        }
      />
    );
  }
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        Fields with a lock are encrypted and only used on {site}. {platformName} never sees them.
      </p>
      {failure ? (
        <Problem title="Could not send it to the store" message={errorMessage(failure)} />
      ) : null}
      <PendingActionForm
        action={showHeading ? action : { ...action, title: "" }}
        submitting={state === "sending"}
        submitLabel={unconfirmed.current ? "Send again" : "Continue"}
        onSubmit={send}
      />
      <Button
        type="button"
        variant="secondary"
        size="xl"
        className="w-full"
        disabled={state === "sending"}
        onClick={() => void decline()}
      >
        Not now
      </Button>
    </div>
  );
}

/** "www.amazon.com" → "amazon.com", for reading. */
function siteName(domain: string): string {
  return domain.replace(/^www\./, "");
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
