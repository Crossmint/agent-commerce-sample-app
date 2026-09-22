"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A command or a URL with a copy button at its end. The text is set in mono
 * on the grey fill, the same shape as a phone-screen field.
 */
export function CopyChip({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null}
      <div className="flex min-h-12 items-center gap-2 rounded-xl bg-muted pr-1.5 pl-4">
        <code className="min-w-0 flex-1 truncate py-3 font-mono text-[13px] text-foreground" title={value}>
          {value}
        </code>
        <button
          type="button"
          aria-label={copied ? "Copied" : `Copy ${label ?? "to clipboard"}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:text-foreground"
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}
