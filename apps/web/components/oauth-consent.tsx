"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useStytch, useStytchSession, useStytchUser } from "@stytch/nextjs";
import { parseOAuthAuthorizeParams } from "@stytch/vanilla-js";
import { AlertCircle, Lock } from "lucide-react";
import { Button, Spinner } from "@agent-commerce/ui";
import { ScreenHeading } from "@/components/focus-screen";
import { cn } from "@/lib/cn";
import { stytchMessage } from "@/lib/stytch-client";

/**
 * The consent screen for Stytch Connected Apps, on the sample app's own
 * components.
 *
 * Stytch ships a prebuilt `IdentityProvider`, but it is its own little design
 * inside our page. The headless `stytch.idp` calls give the same flow:
 * `oauthAuthorizeStart` reads the client and the scopes it asks for, and
 * `oauthAuthorizeSubmit` answers and hands back the URL to leave by. So the
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
        <Problem title="Could not authorize" message="This link is missing something. Ask the agent for a new one." />
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
        <Problem title="Could not authorize" message={state.message} />
      </Step>
    );
  }

  if (state.kind === "answered") {
    return <Step title="Denied" sub="The agent has no login. You can close this tab." />;
  }

  const { client } = state;

  return (
    <Step title={`${client.name} wants to sign in as you`} sub="It can ask you to approve payments. You approve each one on a screen like this.">
      <dl className="flex flex-col rounded-2xl border border-border px-5">
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

      <div className="mt-auto flex flex-col gap-2">
        <Button type="button" size="xl" className="w-full" disabled={Boolean(busy)} onClick={() => void answer(true)}>
          {busy === "allow" ? <Spinner /> : null}
          Allow
        </Button>
        <Button type="button" variant="secondary" size="xl" className="w-full" disabled={Boolean(busy)} onClick={() => void answer(false)}>
          {busy === "deny" ? <Spinner /> : null}
          Deny
        </Button>
      </div>
    </Step>
  );
}

/** The step's name and one line under it, then the step itself. */
function Step({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <ScreenHeading title={title} sub={sub} />
      {children}
    </div>
  );
}

/** One line of the request, as on the approval screen. */
function Row({ label, strong = false, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4 last:border-0">
      <dt className={cn("shrink-0 text-sm", strong ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("min-w-0 text-right text-sm", strong ? "font-semibold" : "font-medium")}>{children}</dd>
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
