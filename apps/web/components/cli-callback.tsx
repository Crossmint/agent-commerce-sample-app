"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button } from "@goat-wallet/ui";

/**
 * The landing page for `goat login --code`, on the same ground as sign in:
 * the heading names the step, the code sits in one block to select or copy,
 * and nothing else competes with it.
 */
export function CliCallback({ code, state, error }: { code?: string; state?: string; error?: string }) {
  const [copied, setCopied] = useState(false);

  if (error || !code) {
    return (
      <Step title="Login did not finish" sub="Nothing was granted.">
        <Alert variant="destructive">
          <AlertTitle>No code came back</AlertTitle>
          <AlertDescription>{error ?? "Run `goat login --code` again."}</AlertDescription>
        </Alert>
      </Step>
    );
  }

  const value = state ? `code=${code}&state=${state}` : code;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the user can select the text */
    }
  }

  return (
    <Step title="Almost there" sub="Paste this into your terminal.">
      <code className="block rounded-md border border-border bg-card px-3 py-2.5 font-mono text-sm break-all select-all">{value}</code>
      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">You can close this window after pasting.</p>
      </div>
    </Step>
  );
}

/** The step's name and one line under it, as on sign in. */
function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-start gap-2">
        <h1 className="font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-4xl">{title}</h1>
        <p className="max-w-prose text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}
