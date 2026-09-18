"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useStytch, useStytchSession } from "@stytch/nextjs";
import { Alert, AlertDescription, AlertTitle, Button, Input, Label, Spinner } from "@goat-wallet/ui";
import { cn } from "@/lib/cn";
import { GoogleMark } from "@/components/landing/social-marks";
import { authenticateWithSessionFallback } from "@/lib/stytch-client";

export const NEXT_COOKIE = "goat_next";

/** How long a passcode stays valid. Stytch allows 1 to 10 minutes. */
const CODE_MINUTES = 10;
const CODE_LENGTH = 6;
/** Seconds before another code can be asked for. */
const RESEND_SECONDS = 30;

const EMPTY_CODE: string[] = Array(CODE_LENGTH).fill("");

const noop = () => () => {};
/** window.location.origin on the client, null during server rendering. */
function useOrigin(): string | null {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => null,
  );
}

/** Stytch throws its API errors with the readable text on `error_message`. */
function stytchMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "error_message" in e) {
    const m = (e as { error_message?: unknown }).error_message;
    if (typeof m === "string" && m) return m;
  }
  return e instanceof Error && e.message ? e.message : fallback;
}

type Status = "idle" | "sending" | "verifying" | "leaving";

/**
 * Sign in with an emailed passcode or with Google, on GOAT's own components:
 * the Stytch headless methods do the work, so the form is ours to style.
 *
 * The passcode never leaves this page. `otps.email.loginOrCreate` returns a
 * `method_id`, the user types the code beside it, and `otps.authenticate`
 * opens the session here — no round trip through /authenticate, which only
 * Google's callback still needs. The page the user wanted travels in a
 * short-lived cookie for that trip, since redirect URLs must match the
 * dashboard exactly.
 *
 * The heading belongs to the form rather than the page because it names the
 * step, and the step changes once a code is on its way.
 */
export function LoginForm({ next }: { next: string }) {
  const stytch = useStytch();
  const router = useRouter();
  const { session, isInitialized } = useStytchSession();
  const origin = useOrigin();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [methodId, setMethodId] = useState("");
  const [code, setCode] = useState("");
  // Bumped to remount the boxes, which is how their contents get cleared.
  const [attempt, setAttempt] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=900; SameSite=Lax`;
  }, [next]);

  useEffect(() => {
    if (isInitialized && session) router.replace(next);
  }, [isInitialized, session, next, router]);

  // One timeout per second, so the resend line counts down on its own.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (!origin || !isInitialized || session) {
    return (
      <Step title="Sign in" sub="Your cards. Your agents. You approve every budget.">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </p>
      </Step>
    );
  }

  const busy = status !== "idle";

  async function sendCode(address: string) {
    setStatus("sending");
    setError(null);
    try {
      const { method_id } = await stytch.otps.email.loginOrCreate(address, { expiration_minutes: CODE_MINUTES });
      setMethodId(method_id);
      setSentTo(address);
      setCode("");
      setAttempt((a) => a + 1);
      setCooldown(RESEND_SECONDS);
      setStatus("idle");
    } catch (e: unknown) {
      setError(stytchMessage(e, "Could not send the code. Try again."));
      setStatus("idle");
    }
  }

  async function verify(entered: string) {
    setStatus("verifying");
    setError(null);
    try {
      await authenticateWithSessionFallback((minutes) => stytch.otps.authenticate(entered, methodId, { session_duration_minutes: minutes }));
      router.replace(next);
      router.refresh();
    } catch (e: unknown) {
      setError(stytchMessage(e, "That code did not work. Ask for a new one."));
      setCode("");
      setAttempt((a) => a + 1);
      setStatus("idle");
    }
  }

  async function continueWithGoogle() {
    if (busy) return;
    setStatus("leaving");
    setError(null);
    try {
      // This redirects the browser, so nothing after it runs on success.
      await stytch.oauth.google.start({ login_redirect_url: `${origin}/authenticate`, signup_redirect_url: `${origin}/authenticate` });
    } catch (e: unknown) {
      setError(stytchMessage(e, "Could not reach Google. Try again."));
      setStatus("idle");
    }
  }

  const alert = error ? (
    <Alert variant="destructive">
      <AlertTitle>Could not sign you in</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  if (methodId) {
    const complete = code.length === CODE_LENGTH;
    return (
      <Step title={`Enter ${CODE_LENGTH} digit code`} sub={`We sent a ${CODE_LENGTH}-digit code to ${sentTo}.`}>
        <div className="flex flex-col gap-5">
          {alert}

          <form
            className="flex flex-col gap-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              if (complete && !busy) void verify(code);
            }}
          >
            <CodeBoxes key={attempt} onChange={setCode} onComplete={(entered) => void verify(entered)} disabled={status === "verifying"} />
            <Button type="submit" disabled={busy || !complete}>
              {status === "verifying" ? (
                <>
                  <Spinner /> Signing you in…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          <div className="flex flex-col gap-1 text-center text-sm text-muted-foreground">
            <p>Can&rsquo;t find the email? Check your spam folder.</p>
            <p>Some emails take a few minutes to arrive.</p>
          </div>

          <p className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            {cooldown > 0 ? (
              <span>Re-send code in {cooldown}s</span>
            ) : (
              <SubtleButton onClick={() => void sendCode(sentTo)} disabled={busy}>
                {status === "sending" ? "Sending…" : "Re-send code"}
              </SubtleButton>
            )}
            <SubtleButton
              onClick={() => {
                setMethodId("");
                setCode("");
                setCooldown(0);
                setError(null);
              }}
              disabled={busy}
            >
              Use a different email
            </SubtleButton>
          </p>
        </div>
      </Step>
    );
  }

  return (
    <Step title="Sign in" sub="Your cards. Your agents. You approve every budget.">
      <div className="flex flex-col gap-5">
        {alert}

        <form
          className="flex flex-col gap-3"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const address = email.trim();
            if (address && !busy) void sendCode(address);
          }}
        >
          <Label htmlFor="email" className="text-foreground">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !email.trim()}>
            {status === "sending" ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              "Email me a code"
            )}
          </Button>
        </form>

        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">or</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <Button variant="outline" onClick={continueWithGoogle} disabled={busy}>
          {status === "leaving" ? <Spinner /> : <GoogleMark className="size-4" />}
          Continue with Google
        </Button>
      </div>
    </Step>
  );
}

/** The step's name and one line under it, then the step itself. */
function Step({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-start gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">{title}</h1>
        <p className="text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * One box per digit. Typing moves forward, backspace moves back, and a pasted
 * code fills every box from the first — a paste has to be caught explicitly,
 * because `maxLength` would otherwise trim it to a single character.
 *
 * `live` mirrors the digits synchronously. Typing fast enough sends several
 * keys before React re-renders, and each handler would otherwise read the
 * same stale state and overwrite the digit before it. The parent clears the
 * boxes by remounting them with a new `key`.
 */
function CodeBoxes({ onChange, onComplete, disabled }: { onChange: (code: string) => void; onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const live = useRef<string[]>(EMPTY_CODE);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  function commit(next: string[]) {
    live.current = next;
    setDigits(next);
    const code = next.join("");
    onChange(code);
    return code.length === CODE_LENGTH;
  }

  /** Write `raw`'s digits from `index` on, then focus and submit as it fits. */
  function write(index: number, raw: string) {
    const chars = raw.replace(/\D/g, "").split("");
    if (chars.length === 0) return;
    const next = [...live.current];
    let at = index;
    for (const c of chars) {
      if (at >= CODE_LENGTH) break;
      next[at] = c;
      at += 1;
    }
    if (commit(next)) onComplete(next.join(""));
    else boxes.current[Math.min(at, CODE_LENGTH - 1)]?.focus();
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...live.current];
      if (next[index]) {
        next[index] = "";
        commit(next);
        return;
      }
      if (index > 0) {
        next[index - 1] = "";
        commit(next);
        boxes.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      boxes.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/\d/.test(text)) return;
    event.preventDefault();
    write(0, text);
  }

  return (
    <div role="group" aria-label={`${CODE_LENGTH} digit code`} className="flex gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <Input
          key={index}
          ref={(el: HTMLInputElement | null) => {
            boxes.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          // Only the first box claims the autofill, so the browser hands the
          // whole code to one place; `write` spreads it across the rest.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={index === 0}
          aria-label={`Digit ${index + 1}`}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => write(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
          onPaste={onPaste}
          onFocus={(e) => e.currentTarget.select()}
          className={cn("h-12 min-w-0 flex-1 px-0 text-center font-mono text-xl sm:h-14 sm:text-2xl")}
        />
      ))}
    </div>
  );
}

/** An understated text action, for the ways out of the code step. */
function SubtleButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline"
    >
      {children}
    </button>
  );
}
