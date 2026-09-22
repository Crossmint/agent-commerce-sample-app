"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Badge,
  Button,
  CheckoutView as CheckoutViewPanel,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@agent-commerce/ui";
import type { CheckoutView } from "@agent-commerce/server";
import { PLATFORM_NAME } from "@/components/brand";
import { checkoutBadgeVariant, checkoutStatusLine, type ToolError } from "./parts";
import { ToolCard, type ToolState } from "./tool-card";

/**
 * A checkout as a card, for the desktop chat: status, what Crossmint needs
 * next, and a button that opens the live checkout in a dialog, so the user
 * watches it and answers its questions without leaving the conversation.
 */
export function CheckoutCard({
  title,
  state,
  input,
  checkout,
  errorText,
}: {
  title: string;
  state: ToolState;
  input?: unknown;
  checkout?: CheckoutView | ToolError;
  errorText?: string;
}) {
  const [open, setOpen] = useState(false);
  const failed = checkout && "error" in checkout ? checkout : undefined;
  const view = checkout && !("error" in checkout) ? checkout : undefined;

  return (
    <ToolCard
      title={title}
      state={state}
      input={input}
      output={checkout}
      errorText={errorText ?? failed?.error}
      summary={view ? checkoutStatusLine(view) : undefined}
    >
      {view ? (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Checkout</dt>
            <dd className="truncate font-mono">{view.id}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={checkoutBadgeVariant(view.status)}>
                {view.status.replace(/_/g, " ")}
              </Badge>
            </dd>
            {view.rendered ? (
              <>
                <dt className="text-muted-foreground">Needs</dt>
                <dd>{view.rendered.title}</dd>
              </>
            ) : null}
            {view.receipt ? (
              <>
                <dt className="text-muted-foreground">Total</dt>
                <dd>
                  {view.receipt.total.amount} {view.receipt.total.currency}
                  {view.receipt.merchantOrderId ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · order {view.receipt.merchantOrderId}
                    </span>
                  ) : null}
                </dd>
              </>
            ) : null}
            {view.failure ? (
              <>
                <dt className="text-muted-foreground">
                  {view.status === "blocked" ? "Stopped" : "Failure"}
                </dt>
                <dd className="text-destructive">{view.failure.message ?? view.failure.reason}</dd>
              </>
            ) : view.result?.summary ? (
              <>
                <dt className="text-muted-foreground">Summary</dt>
                <dd>{view.result.summary}</dd>
              </>
            ) : null}
          </dl>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="self-start"
            onClick={() => setOpen(true)}
          >
            Open checkout <ArrowUpRight />
          </Button>
          <CheckoutDialog checkoutId={view.id} open={open} onOpenChange={setOpen} />
        </div>
      ) : null}
    </ToolCard>
  );
}

/** The live checkout in a wide dialog. Mounted only while open, so polling stops with it. */
export function CheckoutDialog({
  checkoutId,
  open,
  onOpenChange,
}: {
  checkoutId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>
            Watch the agent buy, and answer what the store asks. When it reaches the payment step,
            choose a card here.
          </DialogDescription>
        </DialogHeader>
        {open ? <CheckoutViewPanel checkoutId={checkoutId} platformName={PLATFORM_NAME} /> : null}
      </DialogContent>
    </Dialog>
  );
}
