"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, CircleAlert, CircleCheck, Wrench } from "lucide-react";
import { Spinner, cn } from "@agent-commerce/ui";

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export interface ToolCardProps {
  /** Short human label, e.g. "Listing agent cards". */
  title: string;
  state: ToolState;
  /** One line under the title, e.g. a count or a status. */
  summary?: ReactNode;
  errorText?: string;
  /** Raw input and output, shown behind a toggle. */
  input?: unknown;
  output?: unknown;
  children?: ReactNode;
  className?: string;
}

/**
 * A small card for one tool call. Collapsed by default: title, state, one-line
 * summary. Expands to the raw input and output for anyone who wants to check.
 */
export function ToolCard({ title, state, summary, errorText, input, output, children, className }: ToolCardProps) {
  const [open, setOpen] = useState(false);
  const busy = state === "input-streaming" || state === "input-available" || state === "approval-requested";
  const failed = state === "output-error" || state === "output-denied";
  const hasDetails = input !== undefined || output !== undefined;

  return (
    <div className={cn("w-full max-w-lg overflow-hidden rounded-2xl bg-card text-sm ring-1 ring-foreground/10", className)}>
      <button type="button" disabled={!hasDetails} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
            failed && "bg-destructive/10 text-destructive",
            state === "output-available" && "bg-success/10 text-success",
          )}
        >
          {busy ? <Spinner className="size-3.5" /> : failed ? <CircleAlert className="size-4" /> : state === "output-available" ? <CircleCheck className="size-4" /> : <Wrench className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          {summary || errorText ? <span className={cn("block truncate text-xs text-muted-foreground", failed && "text-destructive")}>{errorText ?? summary}</span> : null}
        </span>
        {hasDetails ? <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} /> : null}
      </button>
      {children ? <div className="border-t border-border px-4 py-3">{children}</div> : null}
      {open && hasDetails ? (
        <div className="space-y-3 border-t border-border bg-muted/40 px-4 py-3 font-mono text-xs">
          {input !== undefined ? <Json label="Input" value={input} /> : null}
          {output !== undefined ? <Json label="Output" value={output} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 font-sans text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
      <pre className="max-h-64 overflow-auto break-all whitespace-pre-wrap text-foreground/90">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

/** "list_agent_cards" → "List agent cards". */
export function humanizeToolName(name: string): string {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
