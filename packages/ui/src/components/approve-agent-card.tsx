"use client";

import * as React from "react";
import type { AgentCard, PaymentMethod } from "@agent-commerce/core";
import { needsCvcRecollection, pendingVerificationRails } from "@agent-commerce/core";
import { AlertCircle, Clock, Lock } from "lucide-react";
import { errorMessage } from "../api/client.js";
import type { AgentCardRequest } from "../api/types.js";
import { isRequestPastDeadline, useAgentCardRequest } from "../hooks/use-agent-card-request.js";
import { usePaymentMethods } from "../hooks/use-payment-methods.js";
import { formatAmount, formatDate, formatDateTime } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { useAgentCommerce } from "../provider.js";
import { Button } from "./primitives/button.js";
import { Label } from "./primitives/label.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";
import { CardPicker } from "./card-picker.js";
import { RecollectCvc } from "./recollect-cvc.js";
import { VerifyAgentCard, type VerificationAppearance } from "./verify-agent-card.js";

/**
 * What the approval screen is called when a checkout reached its payment
 * step. Exported so every surface that shows the step words it the same way.
 */
export const PAYMENT_STEP_ASK = {
  title: "Choose a payment method",
  sub: "The agent pays with a card made for this purchase alone.",
} as const;

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
  /** Country for card registration. Default "US". */
  countryCode?: string;
  /**
   * The name the card network shows in its confirmation window. It is the
   * platform the card is being saved with, not the agent asking. Default "Agent Commerce".
   */
  platformName?: string;
  verificationAppearance?: VerificationAppearance;
  /**
   * What the ask screen is called. The default speaks for an agent that asked
   * for a card out of the blue; a checkout that has reached its payment step
   * passes its own, because there the user is choosing how to pay for
   * something already in front of them.
   */
  ask?: { title: string; sub: string };
  /**
   * "card" stands the screen on its own white panel, which is what a host
   * page usually wants. "plain" drops the panel so the page's own frame, a
   * phone screen, can hold it. Default "card".
   */
  variant?: "card" | "plain";
  className?: string;
}

type Phase =
  | { kind: "choose" }
  | { kind: "approving" }
  | { kind: "verifying"; agentCard: AgentCard }
  | { kind: "recollecting"; agentCard: AgentCard }
  | { kind: "confirming"; agentCard: AgentCard }
  | { kind: "denying" };

/**
 * The approval screen. Structure is fixed:
 * 1. Headline: "<Agent> is requesting to use your card".
 * 2. What is being asked for: Purpose, Limit, and Merchant and Expires when set.
 * 3. The card: a dropdown of saved cards, "Add a new card" at the foot of it.
 *    With nothing saved the card form stands in for the dropdown.
 * 4. One reassurance line with a lock.
 * 5. Full-width Allow. A grey full-width Deny under it.
 * Verification replaces the button area. Every ending replaces the screen,
 * in the onramp sample app's vocabulary: the approved limit as a big blue
 * figure, the rest as a heading and one line.
 */
export function ApproveAgentCard({
  requestId,
  onDone,
  countryCode = "US",
  platformName = "Agent Commerce",
  verificationAppearance,
  ask,
  variant = "card",
  className,
}: ApproveAgentCardProps) {
  const { api } = useAgentCommerce();
  const request = useAgentCardRequest(requestId);
  const req = request.data;
  const isPending = req?.status === "pending" && !isRequestPastDeadline(req);
  const paymentMethods = usePaymentMethods({ enabled: isPending });

  const [selected, setSelected] = React.useState<string | undefined>(undefined);
  const [phase, setPhase] = React.useState<Phase>({ kind: "choose" });
  const [actionError, setActionError] = React.useState<unknown>(undefined);
  const [agentCard, setAgentCard] = React.useState<AgentCard | undefined>(undefined);
  /**
   * The user walked back from verification to the picker. It tells the two
   * "approved" screens apart: coming back to a card mid-verification, which
   * resumes, and asking for a different one, which answers again.
   */
  const [changingCard, setChangingCard] = React.useState(false);

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
        } else if (needsCvcRecollection(card)) {
          setPhase({ kind: "recollecting", agentCard: card });
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
    setChangingCard(false);
    setPhase({ kind: "approving" });
    try {
      let email: string | undefined;
      try {
        email = (await api.me()).email;
      } catch {
        email = undefined;
      }
      const result = await api.approveAgentCardRequest(req.id, {
        paymentMethodId: selected,
        email,
        countryCode,
      });
      // This screen is already showing the new card, so the resume effect has
      // nothing left to do for it.
      resumedFor.current = result.agentCard.orderIntentId;
      setAgentCard(result.agentCard);
      request.setData(result.request);
      if (result.needsVerification) {
        setPhase({ kind: "verifying", agentCard: result.agentCard });
      } else if (result.needsCvcRecollection ?? needsCvcRecollection(result.agentCard)) {
        setPhase({ kind: "recollecting", agentCard: result.agentCard });
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

  /** Back to the picker from verification. The next Allow answers again. */
  function useAnotherCard() {
    setActionError(undefined);
    setChangingCard(true);
    setPhase({ kind: "choose" });
  }

  /**
   * The code is back in the vault. The rail that wanted it flips on Crossmint's
   * side, so the card is read again rather than trusted as it was.
   */
  async function recollected(card: AgentCard) {
    setPhase({ kind: "confirming", agentCard: card });
    setActionError(undefined);
    try {
      const fresh = await api.getAgentCard(card.orderIntentId);
      setAgentCard(fresh);
      await verified(fresh);
    } catch (e) {
      setActionError(e);
      setPhase({ kind: "recollecting", agentCard: card });
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

  const shell = { variant, className };
  // On its own page the headline carries the screen; inside a host panel — a
  // chat bubble, a card in a list — it has to sit among other type.
  const scale: HeaderScale = variant === "plain" ? "page" : "panel";

  if (request.loading && !req) {
    return (
      <Shell {...shell}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-14 w-full" />
      </Shell>
    );
  }

  // Same shape as the not-found page: a line saying what happened, then the
  // one thing worth doing about it. A red panel would be louder than the
  // news, which is usually an old link.
  if (!req) {
    return (
      <Shell {...shell}>
        <Header
          scale={scale}
          title="We could not open this request."
          sub="The link may be old, or the request may be gone. Nothing was charged."
        />
        <Button type="button" size="xl" className="w-full" onClick={() => void request.refetch()}>
          Try again
        </Button>
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
      <Shell {...shell}>
        <Header
          scale={scale}
          title="One more step"
          sub="Confirm with your card network so your agent can get a card number."
        />
        <VerifyAgentCard
          agentCard={agentCard}
          displayName={platformName}
          appearance={verificationAppearance}
          onComplete={() => void verified(agentCard)}
        />
      </Shell>
    );
  }

  // The ending the onramp sample app gives a finished deposit: the figure is
  // the news, so it is the big blue thing, with a small word above it.
  if (req.status === "active") {
    return (
      <Shell {...shell}>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Approved</p>
          <p
            className={cn(
              "font-display font-semibold tracking-tight text-primary tabular-nums",
              scale === "page" ? "text-5xl" : "text-4xl",
            )}
          >
            {limit}
          </p>
          <p className="text-base text-muted-foreground">
            Your agent can spend up to {limit}
            {until ? ` until ${until}` : ""}.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          You can close this tab. Revoke it any time from the app.
        </p>
      </Shell>
    );
  }

  // A denial is a choice, not a fault, so it is not painted in the error colour.
  if (req.status === "denied") {
    return (
      <Shell {...shell}>
        <Header scale={scale} title="Denied" sub="Your agent cannot use your card." />
        <p className="text-sm text-muted-foreground">You can close this tab.</p>
      </Shell>
    );
  }

  if (req.status === "expired" || isRequestPastDeadline(req)) {
    return (
      <Shell {...shell}>
        <Clock aria-hidden className="size-12 text-muted-foreground" />
        <Header
          scale={scale}
          title="This request expired"
          sub={`Ask ${req.requester} to send a new one.`}
        />
      </Shell>
    );
  }

  if (req.status === "failed") {
    return (
      <Shell {...shell}>
        <AlertCircle aria-hidden className="size-12 text-destructive" />
        <Header
          scale={scale}
          title="Something went wrong"
          sub={req.failureReason ?? "The card could not be set up."}
        />
      </Shell>
    );
  }

  // pending or approved
  const busy =
    phase.kind === "approving" || phase.kind === "denying" || phase.kind === "confirming";
  const hasCards = Boolean(paymentMethods.data?.length);
  // A card is already made and the user came back for a different one. The
  // server takes the second answer and revokes the first card.
  const canChooseCard = req.status === "pending" || changingCard;
  // Landing on an approved request with nothing to show yet: the resume
  // effect is fetching the card, so say so rather than offering the picker.
  const resuming = req.status === "approved" && phase.kind === "choose" && !changingCard;

  return (
    <Shell {...shell}>
      <Header
        scale={scale}
        title={ask?.title ?? "Your agent is requesting to use your card"}
        sub={ask?.sub ?? "Approve it once, for this budget only."}
      />

      <dl className="flex flex-col rounded-2xl border border-border px-5">
        <Row label="Purpose">{req.description}</Row>
        <Row label="Limit" strong>
          {limit}
        </Row>
        {req.merchant ? (
          <Row label="Merchant">
            {req.merchant.url ? (
              <a
                href={req.merchant.url}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {req.merchant.name}
              </a>
            ) : (
              req.merchant.name
            )}
          </Row>
        ) : null}
        {req.expiresAt ? <Row label="Expires">{formatDateTime(req.expiresAt)}</Row> : null}
      </dl>

      {canChooseCard ? (
        <div className="flex flex-col gap-2">
          {/* With no cards the picker is one button that names itself. */}
          {hasCards ? (
            <Label htmlFor="approve-card" className="text-sm font-medium">
              Choose card
            </Label>
          ) : null}
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
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        Your card is never shared with the agent.
      </p>

      {actionError ? (
        <Problem title="That did not work" message={errorMessage(actionError)} />
      ) : null}

      {phase.kind === "verifying" ? (
        <VerifyAgentCard
          agentCard={phase.agentCard}
          displayName={platformName}
          appearance={verificationAppearance}
          onUseAnotherCard={useAnotherCard}
          onRetryApproval={() => void allow()}
          onComplete={() => void verified(phase.agentCard)}
        />
      ) : phase.kind === "recollecting" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            One more step. Crossmint&rsquo;s copy of this card&rsquo;s security code lapsed. Enter
            it again and the budget is ready.
          </p>
          <RecollectCvc
            paymentMethodId={phase.agentCard.paymentMethodId}
            onComplete={() => void recollected(phase.agentCard)}
          />
          <Button type="button" variant="link" size="sm" onClick={useAnotherCard}>
            Use a different card
          </Button>
        </div>
      ) : phase.kind === "confirming" || resuming ? (
        <div className="flex items-center gap-3 rounded-2xl bg-muted p-4 text-sm">
          <Spinner className="text-primary" />
          <span>Almost there. Waiting for the card network to confirm.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="xl"
            className="w-full"
            disabled={busy || !selected}
            onClick={() => void allow()}
          >
            {phase.kind === "approving" ? <Spinner /> : null}
            Allow
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xl"
            className="w-full"
            disabled={busy}
            onClick={() => void deny()}
          >
            {phase.kind === "denying" ? <Spinner /> : null}
            Deny
          </Button>
        </div>
      )}
    </Shell>
  );
}

/**
 * The column the screen lives in. `card` gives it its own panel; `plain`
 * leaves it to the page, which is what the sample app's pages do: the phone
 * screen is the frame.
 */
function Shell({
  variant = "card",
  className,
  children,
}: {
  variant?: "card" | "plain";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6",
        variant === "card" &&
          "max-w-md rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

type HeaderScale = "page" | "panel";

/**
 * The headline and the line under it, set like the onramp sample app's
 * screens: on a page the step's name is 28px medium; inside a host panel it
 * steps down so it can sit among other type.
 */
function Header({
  title,
  sub,
  scale = "panel",
}: {
  title: string;
  sub?: string;
  scale?: HeaderScale;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1
        className={cn(
          "text-balance text-foreground",
          scale === "page"
            ? "text-[28px] leading-[1.2] font-medium tracking-[-0.02em]"
            : "text-xl font-medium",
        )}
      >
        {title}
      </h1>
      {sub ? (
        <p className={cn("text-muted-foreground", scale === "page" ? "text-base" : "text-sm")}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** A fault, said plainly: the icon, a title, one line. */
function Problem({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3">
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/** One line of the request: what it is on the left, what it says on the right. */
function Row({
  label,
  strong = false,
  children,
}: {
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-0">
      <dt
        className={cn(
          "shrink-0 text-sm",
          strong ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-right text-sm",
          strong ? "font-semibold tabular-nums" : "font-medium",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function upsert(prev: PaymentMethod[] | undefined, pm: PaymentMethod): PaymentMethod[] {
  const list = prev ?? [];
  if (list.some((x) => x.paymentMethodId === pm.paymentMethodId)) return list;
  return [...list, pm];
}
