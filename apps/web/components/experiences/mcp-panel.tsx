"use client";

import Image from "next/image";
import { ConnectedAgentsBlock } from "./connected-agents-block";
import { CopyChip } from "./copy-chip";
import { ChipSkeleton, Panel, Step } from "./panel";
import type { ExperienceProps } from "./types";
import { useOrigin } from "./use-origin";

/** The MCP hosts people reach for, with their marks from /public/logos. */
const HOSTS = [
  { name: "Claude", logo: "/logos/claude.svg" },
  { name: "ChatGPT", logo: "/logos/openai.svg" },
  { name: "Cursor", logo: "/logos/cursor.svg" },
  { name: "Claude Code", logo: "/logos/claude-code.svg" },
  { name: "Grok Bot", logo: "/logos/grok-bot.svg" },
  { name: "Hermes Agent", logo: "/logos/hermes-agent.png" },
];

/**
 * The app as an MCP server. Nothing to click through: who it works with, the
 * URL, the three steps a host goes through, and the agents that came in this
 * way.
 */
export function McpPanel(props: ExperienceProps) {
  const origin = useOrigin();
  const mcpUrl = origin ? `${origin}/api/mcp` : null;

  return (
    <Panel
      title="Connect an MCP agent"
      sub="Any MCP host can shop with your cards. You choose how to pay before anything is spent."
    >
      {/* Who it works with comes first: it answers "is my host one of these?". */}
      <ul className="flex flex-wrap gap-2" aria-label="MCP hosts">
        {HOSTS.map((h) => (
          <li
            key={h.name}
            className="flex h-9 items-center gap-2 rounded-full bg-muted pr-3.5 pl-2 text-sm font-medium"
          >
            <Image
              src={h.logo}
              alt=""
              width={20}
              height={20}
              className="size-5 rounded-full object-contain"
            />
            {h.name}
          </li>
        ))}
      </ul>

      {mcpUrl ? (
        <CopyChip label="MCP server URL" value={mcpUrl} />
      ) : (
        <ChipSkeleton label="MCP server URL" />
      )}

      <ol className="flex flex-col gap-6">
        <Step n={1}>Paste the URL into your MCP host as a remote server.</Step>
        <Step n={2}>The host opens the consent screen. Log in there and allow the agent.</Step>
        <Step n={3}>
          Ask it to buy something. It requests a budget, and you approve it on the approval page.
        </Step>
      </ol>

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
