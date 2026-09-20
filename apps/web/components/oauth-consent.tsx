"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useStytch, useStytchSession, useStytchUser } from "@stytch/nextjs";
import { parseOAuthAuthorizeParams } from "@stytch/vanilla-js";
import { Lock, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, Spinner } from "@goat-wallet/ui";
import { stytchMessage } from "@/lib/stytch-client";

/**
 * The consent screen for Stytch Connected Apps, on GOAT's own components.
 *
 * Stytch ships a prebuilt `IdentityProvider`, but it is its own little design
 * inside our page. The headless `stytch.idp` calls give the same flow —
 * `oauthAuthorizeStart` reads the client and the scopes it asks for,
 * `oauthAuthorizeSubmit` answers and hands back the URL to leave by — so the
 * screen can be built from the same pieces as sign-in and approval.
 *
 * Answering always ends in a redirect. Even Deny goes back to the client,
 * carrying `error=access_denied`, so the agent waiting on the other end
 * learns the answer instead of timing out.
 */

type Client = { name: string; description?: string; logoUrl?: string };

type State =
  | { kind: "loading" }
  | { kind: "asking"; client: Client }
  | { kind: "leaving" }
  | { kind: "answered"; granted: boolean }
  | { kind: "broken"; message: string };

export function OAuthConsent() {
  const stytch = useStytch();
  const { session, isInitialized } = useStytchSession();
  const { user } = useStytchUser();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);

  // The request lives in the URL, so it is read while rendering rather than
  // written into state from an effect.
  const search = useSearchParams();
  const parsed = useMemo(() => parseOAuthAuthorizeParams(new URLSearchParams(search.toString())), [search]);
  const request = parsed.error ? null : parsed.result;

  /** Submit the answer and follow Stytch's redirect back to the client. */
  const answer = useCallback(
    async (granted: boolean) => {
      if (!request) return;
      setBusy(granted ? "allow" : "deny");
      try {
        const res = await stytch.idp.oauthAuthorizeSubmit({ ...request, consent_granted: granted });
        setState({ kind: "leaving" });
        window.location.replace(res.redirect_uri);
      } catch (e: unknown) {
        // Deny has somewhere to go even when the submit fails: nothing was granted.
        if (!granted) setState({ kind: "answered", granted: false });
        else setState({ kind: "broken", message: stytchMessage(e, "Could not finish. Ask the agent to try again.") });
        setBusy(null);
      }
    },
    [stytch, request],
  );

  useEffect(() => {
    if (!isInitialized || !session || !request) return;
    let cancelled = false;
    (async () => {
      try {
        const start = await stytch.idp.oauthAuthorizeStart({
          client_id: request.client_id,
          redirect_uri: request.redirect_uri,
          response_type: request.response_type,
          scopes: request.scopes,
          ...(request.prompt ? { prompt: request.prompt } : {}),
        });
        if (cancelled) return;
        // Already granted, and the client is not asking again: no screen to show.
        if (!start.consent_required) {
          setState({ kind: "leaving" });
          void answer(true);
          return;
        }
        setState({
          kind: "asking",
          client: {
            name: start.client.client_name,
            description: start.client.client_description || undefined,
            logoUrl: start.client.client_logo_url || undefined,
          },
        });
      } catch (e: unknown) {
        if (!cancelled) setState({ kind: "broken", message: stytchMessage(e, "Could not read this request.") });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stytch, isInitialized, session, request, answer]);

  if (!request) {
    return (
      <Step title="This request will not open" sub="Nothing was granted.">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Could not authorize</AlertTitle>
          <AlertDescription>This link is missing something. Ask the agent for a new one.</AlertDescription>
        </Alert>
      </Step>
    );
  }

  if (!isInitialized || !session || state.kind === "loading" || state.kind === "leaving") {
    return (
      <Step title="One moment" sub="Reading what the agent is asking for.">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </p>
      </Step>
    );
  }

  if (state.kind === "broken") {
    return (
      <Step title="This request will not open" sub="Nothing was granted.">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Could not authorize</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      </Step>
    );
  }

  if (state.kind === "answered") {
    return <Step title="Denied." sub="The agent has no login. You can close this tab." />;
  }

  const { client } = state;

  return (
    <Step
      title={`${client.name} wants to sign in as you`}
      sub="It will be able to request payments from you. You approve each one on a screen like this."
    >
      <dl className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
        <Row label="App">
          <span className="flex items-center justify-end gap-2">
            {client.logoUrl ? (
              // The logo comes from the Stytch app registry, so it is not a
              // host we can name in next.config: a plain img keeps it simple.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logoUrl} alt="" className="size-5 rounded-sm object-contain" />
            ) : null}
            {client.name}
          </span>
        </Row>
        {client.description ? <Row label="What it is">{client.description}</Row> : null}
        <Row label="Account">{user?.emails?.[0]?.email ?? "This account"}</Row>
      </dl>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        Your card is never shared with the agent.
      </p>

      <div className="flex flex-col items-center gap-2">
        <Button type="button" size="lg" className="w-full" disabled={Boolean(busy)} onClick={() => void answer(true)}>
          {busy === "allow" ? <Spinner /> : null}
          Allow
        </Button>
        <Button type="button" variant="link" size="sm" disabled={Boolean(busy)} onClick={() => void answer(false)}>
          {busy === "deny" ? <Spinner /> : null}
          Deny
        </Button>
      </div>
    </Step>
  );
}

/** The step's name and one line under it, as on sign-in. */
function Step({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-start gap-2">
        <h1 className="font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-4xl">{title}</h1>
        {sub ? <p className="max-w-prose text-muted-foreground">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** One line of the request, as on the approval screen. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}
