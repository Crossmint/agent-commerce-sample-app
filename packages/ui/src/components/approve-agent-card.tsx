"use client";

import * as React from "react";
import type { AgentCard } from "@agent-commerce/core";
import type {
  AgentCardAuthorizationResult,
  AgentCardAuthorizationError,
} from "@crossmint/client-sdk-react-ui";
import { AlertCircle } from "lucide-react";
import { errorMessage } from "../api/client.js";
import type { AgentCardRequest } from "../api/types.js";
import { isRequestPastDeadline, useAgentCardRequest } from "../hooks/use-agent-card-request.js";
import { formatAmount, formatDateTime } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { useAgentCommerce } from "../provider.js";
import { AuthorizeAgentCard } from "./authorize-agent-card.js";
import type { VerificationAppearance } from "./verify-agent-card.js";
import { Button } from "./primitives/button.js";
import { Spinner } from "./primitives/spinner.js";

export const PAYMENT_STEP_ASK = {
  title: "Authorize this purchase",
  sub: "Choose a card and complete the authorization below.",
} as const;
export type ApproveOutcomeStatus = "active" | "denied" | "expired" | "failed";
export interface ApproveOutcome {
  status: ApproveOutcomeStatus;
  request: AgentCardRequest;
  agentCard?: AgentCard;
}
export interface ApproveAgentCardProps {
  requestId: string;
  onDone?: (outcome: ApproveOutcome) => void;
  platformName?: string;
  verificationAppearance?: VerificationAppearance;
  ask?: { title: string; sub: string };
  variant?: "card" | "plain";
  className?: string;
}

/** All approval surfaces use the SDK; the app only records its authorized order intent. */
export function ApproveAgentCard(props: ApproveAgentCardProps) {
  return <Approval key={props.requestId} {...props} />;
}

function Approval({
  requestId,
  onDone,
  platformName = "Agent Commerce",
  verificationAppearance,
  ask,
  variant = "card",
  className,
}: ApproveAgentCardProps) {
  const { api } = useAgentCommerce();
  const request = useAgentCardRequest(requestId);
  const [confirmedRequest, setConfirmedRequest] = React.useState<AgentCardRequest>();
  const req = confirmedRequest ?? request.data;
  const receivedId = React.useRef<string | undefined>(undefined);
  const [pendingId, setPendingId] = React.useState<string>();
  const [restored, setRestored] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<unknown>();
  const [sdkError, setSdkError] = React.useState<AgentCardAuthorizationError>();
  const submitting = React.useRef(false);
  const denying = React.useRef(false);
  const reported = React.useRef(false);
  const storageKey = `agent-commerce:authorization:${requestId}`;

  // Only an opaque ID is retained, never JWTs or payment data. A reload after
  // onAuthorized retries association rather than mounting the SDK to create another intent.
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey) ?? undefined;
      receivedId.current = saved;
      setPendingId(saved);
    } catch {
      console.warn("[sdk-evaluation] authorization.recovery_storage_unavailable");
    }
    setRestored(true);
  }, [storageKey]);

  const remember = (id?: string) => {
    setPendingId(id);
    try {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    } catch {
      console.warn("[sdk-evaluation] authorization.recovery_storage_unavailable");
    }
  };

  React.useEffect(() => {
    if (!req || (request.error && !confirmedRequest) || reported.current) return;
    const final =
      req.status === "active" || req.status === "denied" || req.status === "failed"
        ? req.status
        : req.status === "expired" || isRequestPastDeadline(req)
          ? "expired"
          : null;
    if (!final) return;
    reported.current = true;
    if (final === "active") {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Best effort. */
      }
    }
    onDone?.({ status: final, request: req });
  }, [req, request.error, confirmedRequest, onDone, storageKey]);

  async function attach(orderIntentId: string) {
    if (submitting.current || denying.current) return;
    submitting.current = true;
    setBusy(true);
    setActionError(undefined);
    try {
      const result = await api.authorizeAgentCardRequest(requestId, orderIntentId);
      setConfirmedRequest(result.request);
      request.setData(result.request);
      remember(undefined);
    } catch (error) {
      setActionError(error);
      console.warn("[sdk-evaluation] authorization.attach_failed", { requestId, orderIntentId });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function authorized(result: AgentCardAuthorizationResult) {
    // AuthorizeAgentCard logs EVERY SDK callback before this app-side deduplication.
    if (receivedId.current && receivedId.current !== result.orderIntentId) {
      console.warn("[sdk-evaluation] authorization.unexpected_second_intent", {
        requestId,
        orderIntentId: result.orderIntentId,
      });
      return;
    }
    if (reported.current) return;
    receivedId.current = result.orderIntentId;
    remember(result.orderIntentId);
    setSdkError(undefined);
    void attach(result.orderIntentId);
  }

  async function deny() {
    if (submitting.current || denying.current) return;
    denying.current = true;
    setBusy(true);
    setActionError(undefined);
    try {
      const denied = await api.denyAgentCardRequest(requestId);
      setConfirmedRequest(denied);
      request.setData(denied);
    } catch (error) {
      setActionError(error);
    } finally {
      denying.current = false;
      setBusy(false);
    }
  }

  const shell = { variant, className };
  const scale: HeaderScale = variant === "plain" ? "page" : "panel";
  if (!restored || (request.loading && !req))
    return (
      <Shell {...shell}>
        <p role="status">
          <Spinner /> Loading authorization…
        </p>
      </Shell>
    );
  if (!req || (request.error && !confirmedRequest))
    return (
      <Shell {...shell}>
        <Header
          scale={scale}
          title="We could not open this request"
          sub="Refresh the request before authorizing."
        />
        <Button onClick={() => void request.refetch()}>Try again</Button>
      </Shell>
    );
  const limit = formatAmount(req.amount.value, req.amount.currency);
  if (req.status === "active")
    return (
      <Shell {...shell}>
        <Header
          scale={scale}
          title="Approved"
          sub={`${limit} authorized for ${req.merchant?.name ?? "this purchase"}.`}
        />
      </Shell>
    );
  if (req.status === "denied")
    return (
      <Shell {...shell}>
        <Header scale={scale} title="Denied" sub="This request will not be used to pay." />
      </Shell>
    );
  if (req.status === "expired" || isRequestPastDeadline(req))
    return (
      <Shell {...shell}>
        <Header
          scale={scale}
          title="This request expired"
          sub="Ask your agent for a new request."
        />
      </Shell>
    );
  if (req.status === "failed")
    return (
      <Shell {...shell}>
        <Problem
          title="Authorization failed"
          message={req.failureReason ?? "Request a new authorization."}
        />
      </Shell>
    );
  if (req.status === "approved" || !req.merchant)
    return (
      <Shell {...shell}>
        <Problem
          title="A new request is needed"
          message="Ask your agent for a new authorization with the merchant, website and country."
        />
        <Button disabled={busy} onClick={() => void deny()}>
          Deny this request
        </Button>
        {actionError ? (
          <Problem title="Could not deny" message={errorMessage(actionError)} />
        ) : null}
      </Shell>
    );

  return (
    <Shell {...shell}>
      <Header
        scale={scale}
        title={ask?.title ?? "Authorize your agent to use a card"}
        sub={ask?.sub ?? "Choose a card for this merchant and amount."}
      />
      <dl className="flex flex-col rounded-2xl border border-border px-5">
        <Row label="Purpose">{req.description}</Row>
        <Row label="Limit" strong>
          {limit}
        </Row>
        <Row label="Merchant">{req.merchant.name}</Row>
        <Row label="Website">{req.merchant.url}</Row>
        <Row label="Country">{req.merchant.countryCode}</Row>
        <Row label="Expires">{formatDateTime(req.expiresAt)}</Row>
      </dl>
      {actionError ? (
        <Problem title="Could not save authorization" message={errorMessage(actionError)} />
      ) : null}
      {pendingId ? (
        <div className="flex flex-col gap-3">
          <p role="status">
            {busy
              ? "Saving authorization…"
              : "Your card authorization is ready. Save it to continue."}
          </p>
          <Button disabled={busy} onClick={() => void attach(pendingId)}>
            {busy ? <Spinner /> : null}Retry saving authorization
          </Button>
        </div>
      ) : (
        <>
          {sdkError ? (
            <Problem
              title="Card authorization did not complete"
              message={`${sdkError.code}: ${sdkError.message}`}
            />
          ) : null}
          <AuthorizeAgentCard
            amount={req.amount}
            merchant={req.merchant}
            description={req.description}
            expiresAt={req.expiresAt}
            displayName={platformName}
            allowedModes={["existing", "new"]}
            appearance={
              verificationAppearance ? { verification: verificationAppearance } : undefined
            }
            onAuthorized={authorized}
            onError={setSdkError}
          />
          <Button variant="secondary" disabled={busy} onClick={() => void deny()}>
            Deny
          </Button>
        </>
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
