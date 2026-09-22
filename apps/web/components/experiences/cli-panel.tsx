"use client";

import { ConnectedAgentsBlock } from "./connected-agents-block";
import { CopyChip } from "./copy-chip";
import { ChipSkeleton, Panel } from "./panel";
import type { ExperienceProps } from "./types";
import { useOrigin } from "./use-origin";

/**
 * The app as a CLI for terminal agents: install, log in, teach the agent the
 * skill, and what a run looks like.
 */
export function CliPanel(props: ExperienceProps) {
  const origin = useOrigin();

  return (
    <Panel title="Give a terminal agent a card" sub="Claude Code, Codex and OpenClaw can buy from the shell with the same approvals.">
      <div className="flex flex-col gap-4">
        <CopyChip label="Install" value="npm i -g @agent-commerce/cli" />
        {origin ? <CopyChip label="Log in" value={`agent-commerce login --api ${origin}/api/agent-commerce`} /> : <ChipSkeleton label="Log in" />}
        <div className="flex flex-col gap-1.5">
          {origin ? <CopyChip label="Teach the agent" value={`Set up ${origin}/install`} /> : <ChipSkeleton label="Teach the agent" />}
          <p className="text-xs text-muted-foreground">Paste this into Claude Code, Codex or OpenClaw and it installs the skill.</p>
        </div>
        <CopyChip label="Or add the skill by hand" value="npx skills add crossmint/goat" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">What a run looks like</h2>
        <pre className="overflow-x-auto rounded-2xl bg-foreground p-4 font-mono text-xs leading-relaxed text-background">
          <code>
            <Line prompt>agent-commerce agent-card request --amount 35 --description &quot;Running shoes&quot; --wait</Line>
            <Line dim>Approve at {origin ?? "https://agent-commerce.example"}/approve/req_7f2…</Line>
            <Line>active · agent card oi_4c9a…</Line>
            <Line prompt>agent-commerce checkout create --url https://nike.com/… --agent-card oi_4c9a… --max-cost 35 --wait</Line>
            <Line>succeeded · order NK-88213</Line>
          </code>
        </pre>
      </section>

      <ConnectedAgentsBlock choice={props} signedIn={props.signedIn} sessions={props.sessions} sessionsNote={props.sessionsNote} revokeSession={props.revokeSession} onSignedIn={props.onSignedIn} />
    </Panel>
  );
}

function Line({ prompt, dim, children }: { prompt?: boolean; dim?: boolean; children: React.ReactNode }) {
  return (
    <span className={dim ? "block opacity-60" : "block"}>
      {prompt ? <span className="opacity-60">$ </span> : null}
      {children}
    </span>
  );
}
