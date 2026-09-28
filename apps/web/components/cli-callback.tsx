"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@agent-commerce/ui";
import { ScreenHeading } from "@/components/focus-screen";

/**
 * The landing page for `agent-commerce login --code`, on the same ground as
 * sign in: the heading names the step, the code sits in one grey block to
 * select or copy, and nothing else competes with it.
 */
export function CliCallback({ code, state, error }: { code?: string; state?: string; error?: string }) {
  const [copied, setCopied] = useState(false);

  if (error || !code) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <ScreenHeading title="Login did not finish" sub="Nothing was granted." />
        <div role="alert" className="flex items-start gap-3">
          <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">No code came back</p>
            <p className="text-sm text-muted-foreground">{error ?? "Run agent-commerce login --code again."}</p>
          </div>
        </div>
      </div>
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
    <div className="flex flex-1 flex-col gap-6">
      <ScreenHeading title="Almost there" sub="Paste this into your terminal." />
      <code className="block rounded-2xl bg-muted px-4 py-3 font-mono text-sm break-all select-all">{value}</code>
      <div className="flex flex-col gap-3">
        <Button size="xl" className="w-full" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">You can close this window after pasting.</p>
      </div>
    </div>
  );
}
