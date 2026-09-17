"use client";

import * as React from "react";
import { Bot, Laptop } from "lucide-react";
import { cn } from "../lib/utils.js";
import { formatDateTime } from "../lib/format.js";
import { Badge } from "./primitives/badge.js";
import { Button } from "./primitives/button.js";
import { Skeleton } from "./primitives/skeleton.js";
import { Spinner } from "./primitives/spinner.js";
import { EmptyState } from "./mascot.js";

export interface ConnectedAgentSession {
  id: string;
  /** "Claude Code", "ChatGPT", "This browser". */
  label: string;
  lastActive?: string;
  /** The session the viewer is using right now. */
  current?: boolean;
  /** True for CLI or MCP sessions. Picks the icon. */
  agent?: boolean;
}

export interface ConnectedAgentsProps {
  sessions: ConnectedAgentSession[] | undefined;
  loading?: boolean;
  onRevoke?: (sessionId: string) => void | Promise<void>;
  className?: string;
  mascotSrc?: string;
}

/**
 * The user's sessions. Each connected CLI or MCP host is one session on the
 * platform's auth provider. Revoking a session logs that agent out.
 */
export function ConnectedAgents({ sessions, loading = false, onRevoke, className, mascotSrc }: ConnectedAgentsProps) {
  const [busy, setBusy] = React.useState<string | null>(null);

  if (loading && !sessions) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (!sessions?.length) {
    return (
      <EmptyState
        className={className}
        mascotSrc={mascotSrc}
        mascotSize={56}
        title="No agents connected"
        description="Run goat login in a terminal, or connect an MCP client, and it appears here."
      />
    );
  }

  return (
    <ul className={cn("flex flex-col divide-y divide-border rounded-md border border-border bg-card", className)}>
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-4 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {s.agent ? <Bot className="size-5" /> : <Laptop className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{s.label}</p>
              {s.current ? <Badge variant="muted">This session</Badge> : null}
            </div>
            {s.lastActive ? (
              <p className="text-xs text-muted-foreground">Last active {formatDateTime(s.lastActive)}</p>
            ) : null}
          </div>
          {onRevoke ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy === s.id}
              onClick={async () => {
                setBusy(s.id);
                try {
                  await onRevoke(s.id);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === s.id ? <Spinner /> : null}
              {s.current ? "Sign out" : "Revoke"}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
