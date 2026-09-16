"use client";

import * as React from "react";
import type { AgentCard, PaymentMethod } from "@goat-wallet/core";
import { pendingVerificationRails } from "@goat-wallet/core";
import { Clock, Lock, TriangleAlert } from "lucide-react";
import { errorMessage } from "../api/client.js";
import type { AgentCardRequest } from "../api/types.js";
import { isRequestPastDeadline, useAgentCardRequest } from "../hooks/use-agent-card-request.js";
import { usePaymentMethods } from "../hooks/use-payment-methods.js";
import { formatAmount, formatDate, formatDateTime } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { useGoat } from "../provider.js";
import { Alert, AlertDescription, AlertTitle } from "./primitives/alert.js";
import { Button } from "./primitives/button.js";
import { Label } from "./primitives/label.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";
import { CardPicker } from "./card-picker.js";
import { Mascot } from "./mascot.js";
import { VerifyAgentCard, type VerificationAppearance } from "./verify-agent-card.js";

export type ApproveOutcomeStatus = "active" | "denied" | "expired" | "failed";

export interface ApproveOutcome {
  status: ApproveOutcomeStatus;
  request: AgentCardRequest;
  agentCard?: AgentCard;
}

export interface ApproveAgentCardProps {
  requestId: string;
  /** Called once the request reaches a final state. */
  onDone?: (outcome: ApproveOutcome) => void;
  /** Mascot for the success state. Default "/brand/mark.png". */
  mascotSrc?: string;
  /** Country for card registration. Default "US". */
  countryCode?: string;
  verificationAppearance?: VerificationAppearance;
  className?: string;
}

type Phase =
  | { kind: "choose" }
  | { kind: "approving" }
  | { kind: "verifying"; agentCard: AgentCard }
  | { kind: "confirming"; agentCard: AgentCard }
  | { kind: "denying" };

/**
 * The approval screen. Structure is fixed:
 * 1. Headline: "<Agent> is requesting to use your card".
 * 2. Purpose, Limit. Merchant and Expires only when set.
 * 3. "Choose card" with saved cards. "Add a new card" at the bottom.
 * 4. One reassurance line with a lock.
 * 5. Full-width Allow. Quiet Deny link under it.
 * Verification replaces the button area. Success replaces the whole card.
 */
export function ApproveAgentCard({
  requestId,
  onDone,
  mascotSrc,
  countryCode = "US",
  verificationAppearance,
  className,
}: ApproveAgentCardProps) {
  const { api } = useGoat();
  const request = useAgentCardRequest(requestId);
  const req = request.data;
  const isPending = req?.status === "pending" && !isRequestPastDeadline(req);
  const paymentMethods = usePaymentMethods({ enabled: isPending });

  const [selected, setSelected] = React.useState<string | undefined>(undefined);
  const [phase, setPhase] = React.useState<Phase>({ kind: "choose" });
  const [actionError, setActionError] = React.useState<unknown>(undefined);
  const [agentCard, setAgentCard] = React.useState<AgentCard | undefined>(undefined);

  // Pick the default card once cards load.
  React.useEffect(() => {
    if (selected || !paymentMethods.data?.length) return;
    const def = paymentMethods.data.find((pm) => pm.default) ?? paymentMethods.data[0];
    if (def) setSelected(def.paymentMethodId);
  }, [paymentMethods.data, selected]);

  // Returning to an approved request: load the agent card and resume verification.
  const resumedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!req || req.status !== "approved" || !req.agentCardId) return;
    if (resumedFor.current === req.agentCardId) return;
    resumedFor.current = req.agentCardId;
    let cancelled = false;
    (async () => {
      try {
        const card = await api.getAgentCard(req.agentCardId as string);
        if (cancelled) return;
        setAgentCard(card);
        if (pendingVerificationRails(card).length) {
          setPhase({ kind: "verifying", agentCard: card });
        } else {
          setPhase({ kind: "confirming", agentCard: card });
          await api.verifiedAgentCardRequest(req.id);
          await request.refetch();
        }
      } catch (e) {
        if (!cancelled) setActionError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.status, req?.agentCardId]);

  // Report the final state once.
  const reported = React.useRef(false);
  React.useEffect(() => {
    if (!req || reported.current) return;
    const final: ApproveOutcomeStatus | null =
      req.status === "active"
        ? "active"
        : req.status === "denied"
          ? "denied"
          : req.status === "expired" || isRequestPastDeadline(req)
            ? "expired"
            : req.status === "failed"
              ? "failed"
              : null;
    if (final) {
      reported.current = true;
      onDone?.({ status: final, request: req, agentCard });
    }
  }, [req, agentCard, onDone]);

  async function allow() {
    if (!req || !selected) return;
    setActionError(undefined);
    setPhase({ kind: "approving" });
    try {
      let email: string | undefined;
      try {
        email = (await api.me()).email;
      } catch {
        email = undefined;
      }
      const result = await api.approveAgentCardRequest(req.id, { paymentMethodId: selected, email, countryCode });
      setAgentCard(result.agentCard);
      request.setData(result.request);
      if (result.needsVerification) {
        setPhase({ kind: "verifying", agentCard: result.agentCard });
      } else {
        setPhase({ kind: "confirming", agentCard: result.agentCard });
        if (result.request.status !== "active") {
          const verified = await api.verifiedAgentCardRequest(req.id);
          setAgentCard(verified.agentCard);
          request.setData(verified.request);
        }
      }
    } catch (e) {
      setActionError(e);
      setPhase({ kind: "choose" });
      void request.refetch();
    }
  }

  async function verified(card: AgentCard) {
    setPhase({ kind: "confirming", agentCard: card });
    setActionError(undefined);
    try {
      const result = await api.verifiedAgentCardRequest(requestId);
      setAgentCard(result.agentCard);
      request.setData(result.request);
      // If the network is still settling, the hook keeps polling while `approved`.
    } catch (e) {
      setActionError(e);
      setPhase({ kind: "verifying", agentCard: card });
    }
  }

  async function deny() {
    if (!req) return;
    setActionError(undefined);
    setPhase({ kind: "denying" });
    try {
      const result = await api.denyAgentCardRequest(req.id);
      request.setData(result);
    } catch (e) {
      setActionError(e);
      setPhase({ kind: "choose" });
    }
  }

  // ----- Render -----

  if (request.loading && !req) {
    return (
      <Shell className={className}>
        <Skeleton className="h-9 w-3/4" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full rounded-md" />
      </Shell>
    );
  }

  if (!req) {
    return (
      <Shell className={className}>
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Could not load this request</AlertTitle>
          <AlertDescription>
            <p>{errorMessage(request.error)}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void request.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  const limitValue = agentCard?.amount.total ?? req.amount.value;
  const limitCurrency = agentCard?.amount.currency ?? req.amount.currency;
  const limit = formatAmount(limitValue, limitCurrency);
  const until = formatDate(agentCard?.expiresAt ?? req.expiresAt);

  // Defensive: if the record says active but the network rail still needs the user,
  // keep them on the verification step instead of showing success.
  const stillPending = agentCard ? pendingVerificationRails(agentCard).length > 0 : false;
  if (req.status === "active" && stillPending && agentCard) {
    return (
      <Shell className={cn("goat-backdrop", className)}>
        <h1 className="text-2xl font-semibold tracking-tight">One more step</h1>
        <p className="text-sm text-muted-foreground">
          Confirm with your card network so {req.requester} can get a card number.
        </p>
        <VerifyAgentCard
          agentCard={agentCard}
          displayName={req.requester}
          appearance={verificationAppearance}
          onComplete={() => void verified(agentCard)}
        />
      </Shell>
    );
  }

  if (req.status === "active") {
    return (
      <Shell className={cn("goat-backdrop items-center text-center", className)}>
        <Mascot src={mascotSrc} size={112} />
        <h1 className="text-2xl font-semibold tracking-tight">
          Active. {req.requester} can spend up to {limit} until {until}.
        </h1>
        <p className="text-sm text-muted-foreground">You can revoke this any time from your wallet.</p>
      </Shell>
    );
  }

  if (req.status === "denied") {
    return (
      <Shell className={cn("items-center text-center", className)}>
        <Mascot src={mascotSrc} size={96} className="opacity-80 grayscale" />
        <h1 className="text-2xl font-semibold tracking-tight">Denied.</h1>
        <p className="text-muted-foreground">{req.requester} cannot use your card.</p>
      </Shell>
    );
  }

  if (req.status === "expired" || isRequestPastDeadline(req)) {
    return (
      <Shell className={cn("items-center text-center", className)}>
        <Clock className="size-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">This request expired.</h1>
        <p className="text-muted-foreground">Ask {req.requester} to send a new one.</p>
      </Shell>
    );
  }

  if (req.status === "failed") {
    return (
      <Shell className={cn("items-center text-center", className)}>
        <TriangleAlert className="size-10 text-destructive" />
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong.</h1>
        <p className="text-muted-foreground">{req.failureReason ?? "The card could not be set up."}</p>
      </Shell>
    );
  }

  // pending or approved
  const busy = phase.kind === "approving" || phase.kind === "denying" || phase.kind === "confirming";

  return (
    <Shell className={className}>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {req.requester} is requesting to use your card
      </h1>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Purpose</dt>
        <dd className="font-medium">{req.description}</dd>
        <dt className="text-muted-foreground">Limit</dt>
        <dd className="font-medium">{limit}</dd>
        {req.merchant ? (
          <>
            <dt className="text-muted-foreground">Merchant</dt>
            <dd className="font-medium">
              {req.merchant.url ? (
                <a href={req.merchant.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                  {req.merchant.name}
                </a>
              ) : (
                req.merchant.name
              )}
            </dd>
          </>
        ) : null}
        {req.expiresAt ? (
          <>
            <dt className="text-muted-foreground">Expires</dt>
            <dd className="font-medium">{formatDateTime(req.expiresAt)}</dd>
          </>
        ) : null}
      </dl>

      {req.status === "pending" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="approve-card">Choose card</Label>
          <CardPicker
            id="approve-card"
            paymentMethods={paymentMethods.data}
            loading={paymentMethods.loading}
            value={selected}
            disabled={busy}
            onChange={setSelected}
            onAdded={({ paymentMethod }) => {
              paymentMethods.setData((prev) => upsert(prev, paymentMethod));
            }}
            saveCardProps={{ countryCode }}
          />
        </div>
      ) : null}

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Your card number is never shared with the agent or the store.
      </p>

      {actionError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{errorMessage(actionError)}</AlertDescription>
        </Alert>
      ) : null}

      {phase.kind === "verifying" ? (
        <VerifyAgentCard
          agentCard={phase.agentCard}
          displayName={req.requester}
          appearance={verificationAppearance}
          onComplete={() => void verified(phase.agentCard)}
        />
      ) : phase.kind === "confirming" || (req.status === "approved" && phase.kind === "choose") ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <Spinner className="text-primary" />
          <span>Almost there. Waiting for the card network to confirm.</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Button type="button" size="lg" className="w-full" disabled={busy || !selected} onClick={() => void allow()}>
            {phase.kind === "approving" ? <Spinner /> : null}
            Allow
          </Button>
          <Button type="button" variant="link" size="sm" disabled={busy} onClick={() => void deny()}>
            {phase.kind === "denying" ? <Spinner /> : null}
            Deny
          </Button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

function upsert(prev: PaymentMethod[] | undefined, pm: PaymentMethod): PaymentMethod[] {
  const list = prev ?? [];
  if (list.some((x) => x.paymentMethodId === pm.paymentMethodId)) return list;
  return [...list, pm];
}
