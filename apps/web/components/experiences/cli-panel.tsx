"use client";

import { ConnectedAgentsBlock } from "./connected-agents-block";
import { CopyChip } from "./copy-chip";
import { ChipSkeleton, Panel } from "./panel";
import type { ExperienceProps } from "./types";
import { useOrigin } from "./use-origin";

/**
 * The app as a CLI for terminal agents. One line to hand the agent: the
 * install page teaches it the skill, and the skill installs the CLI and logs
 * it in, so nothing here asks the reader to run those steps themselves.
 */
export function CliPanel(props: ExperienceProps) {
  const origin = useOrigin();

  return (
    <Panel
      title="Give a terminal agent a card"
      sub="Claude Code, Codex and OpenClaw can buy from the shell with the same approvals."
    >
      <div className="flex flex-col gap-1.5">
        {origin ? (
          <CopyChip label="Give this to your agent" value={`Set up ${origin}/install`} />
        ) : (
          <ChipSkeleton label="Give this to your agent" />
        )}
        <p className="text-xs text-muted-foreground">
          Paste this into Claude Code, Codex or OpenClaw and it installs the skill.
        </p>
      </div>

      <ConnectedAgentsBlock
        choice={props}
        signedIn={props.signedIn}
        sessions={props.sessions}
        sessionsNote={props.sessionsNote}
        revokeSession={props.revokeSession}
        onSignedIn={props.onSignedIn}
      />
    </Panel>
  );
}
