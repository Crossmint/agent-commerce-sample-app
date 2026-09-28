"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useStytch, useStytchSession } from "@stytch/nextjs";
import { Alert, AlertDescription, AlertTitle, Button, Input, Spinner } from "@agent-commerce/ui";
import { cn } from "@/lib/cn";
import { authenticateWithSessionFallback, stytchMessage } from "@/lib/stytch-client";

export const NEXT_COOKIE = "ac_next";

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

type Status = "idle" | "sending" | "verifying" | "leaving";

/** The phone-screen field: tall, 12px corners, on the grey fill, no border. */
const FIELD = "h-12 rounded-xl border-0 bg-muted px-4 text-base shadow-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

export interface LoginFormProps {
  /** Where to go once signed in. Same-origin path. */
  next: string;
  /** One line under the heading. */
  sub?: string;
  /** Called instead of navigating, for a login that lives inside another screen. */
  onSignedIn?: () => void;
  className?: string;
}

/**
 * Sign in with Google or an emailed passcode, laid out like the onramp
 * sample app's login screen: the step's name in 28px, one line under it,
 * then tall pill buttons.
 *
 * The Stytch headless methods do the work, so the form is ours to style. The
 * passcode never leaves this screen: `otps.email.loginOrCreate` returns a
 * `method_id`, the user types the code beside it, and `otps.authenticate`
 * opens the session here. Google's callback goes through /authenticate; the
 * page the user wanted travels in a short-lived cookie for that trip.
 */
export function LoginForm({ next, sub = "Log in to save cards and approve what your agents spend.", onSignedIn, className }: LoginFormProps) {
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
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=900; SameSite=Lax`;
  }, [next]);

  function finish() {
    if (onSignedIn) {
      onSignedIn();
      router.refresh();
      return;
    }
    router.replace(next);
    router.refresh();
  }

  useEffect(() => {
    if (isInitialized && session && !onSignedIn) router.replace(next);
  }, [isInitialized, session, next, router, onSignedIn]);

  // One timeout per second, so the resend line counts down on its own.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (!origin || !isInitialized || (session && !onSignedIn)) {
    return (
      <Step title="Log in" sub={sub} className={className}>
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
      finish();
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
      <Step title="Enter the code" sub={`We sent a ${CODE_LENGTH}-digit code to ${sentTo}.`} className={className}>
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
            <Button type="submit" size="xl" className="w-full" disabled={busy || !complete}>
              {status === "verifying" ? (
                <>
                  <Spinner /> Signing you in…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">Can&rsquo;t find the email? Check your spam folder.</p>

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
    <Step title="Log in" sub={sub} className={className}>
      <div className="flex flex-col gap-3">
        {alert}

        <Button variant="secondary" size="xl" className="w-full" onClick={continueWithGoogle} disabled={busy}>
          {status === "leaving" ? <Spinner /> : <Image src="/icons/google.svg" alt="" width={18} height={18} />}
          Continue with Google
        </Button>

        {emailOpen ? (
          <form
            className="enter-up flex flex-col gap-3 pt-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const address = email.trim();
              if (address && !busy) void sendCode(address);
            }}
          >
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              aria-label="Email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className={FIELD}
            />
            <Button type="submit" size="xl" className="w-full" disabled={busy || !email.trim()}>
              {status === "sending" ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                "Email me a code"
              )}
            </Button>
          </form>
        ) : (
          <Button variant="secondary" size="xl" className="w-full" onClick={() => setEmailOpen(true)} disabled={busy}>
            Continue with email
          </Button>
        )}
      </div>
    </Step>
  );
}

/** The step's name and one line under it, then the step itself. */
function Step({ title, sub, className, children }: { title: string; sub: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-foreground">{title}</h1>
        <p className="text-base text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * One box per digit. Typing moves forward, backspace moves back, and a pasted
 * code fills every box from the first. `live` mirrors the digits
 * synchronously so fast typing never reads stale state.
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
    <div role="group" aria-label={`${CODE_LENGTH} digit code`} className="flex gap-2">
      {digits.map((digit, index) => (
        <Input
          key={index}
          ref={(el: HTMLInputElement | null) => {
            boxes.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
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
          className={cn(FIELD, "min-w-0 flex-1 px-0 text-center font-display text-xl tabular-nums")}
        />
      ))}
    </div>
  );
}

/** An understated text action, for the ways out of the code step. */
function SubtleButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50 disabled:hover:no-underline">
      {children}
    </button>
  );
}
