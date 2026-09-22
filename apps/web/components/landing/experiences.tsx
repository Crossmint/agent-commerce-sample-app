"use client";

import { type ComponentType, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { AgentAppMock } from "./mocks/agent-app-mock";
import { MessagingMock } from "./mocks/messaging-mock";
import { McpMock } from "./mocks/mcp-mock";
import { TerminalMock } from "./mocks/terminal-mock";
import { Section, SectionHeading } from "./section";

/*
 * Section `#experiences`: the same APIs behind four kinds of agent, all of
 * them Acme Agent. A pill tab strip picks one; the visual on the left and
 * the copy on the right follow. Each visual remounts on pick, so its
 * timeline starts over.
 */

interface Experience {
  id: string;
  tab: string;
  title: string;
  body: string;
  view: string;
  Visual: ComponentType<{ className?: string }>;
}

const EXPERIENCES: Experience[] = [
  {
    id: "apps",
    tab: "Agent apps",
    title: "Approve inside your own app",
    body: "Your chat, your components. The approval card sits in the thread, the saved cards live in the sidebar, and the agent gets its budget without leaving the conversation. Built with the components in @agent-commerce/ui, in your brand.",
    view: "desktop",
    Visual: AgentAppMock,
  },
  {
    id: "messaging",
    tab: "Messaging apps",
    title: "Send a link when there is no screen",
    body: "An agent on WhatsApp, iMessage or Instagram has no UI of its own. It sends the approval link, the user taps it, approves on a page your platform hosts, and the receipt comes back as a message.",
    view: "messaging",
    Visual: MessagingMock,
  },
  {
    id: "terminal",
    tab: "Terminal agents",
    title: "Your own CLI for agents in a shell",
    body: "Coding agents and scripts drive the same APIs from the command line, through a CLI that carries your name. Request a budget, wait for the approval, create the checkout, wait for the receipt. Every command prints JSON with --json.",
    view: "cli",
    Visual: TerminalMock,
  },
  {
    id: "mcp",
    tab: "MCP server",
    title: "Plug it into any MCP host",
    body: "One URL on your domain in the host's settings and the agent sees six tools: list the saved cards, request an agent card, create a checkout, answer its questions. OAuth signs the user in the first time.",
    view: "mcp",
    Visual: McpMock,
  },
];

export function Experiences() {
  const [active, setActive] = useState(0);
  const current = EXPERIENCES[active] ?? EXPERIENCES[0]!;
  const { Visual } = current;

  return (
    <Section id="experiences">
      <SectionHeading
        title="Support any agentic user experience"
        sub="The same three APIs behind a chat app, a messaging bot, a terminal agent or an MCP host."
      />

      <div
        role="tablist"
        aria-label="Experiences"
        className="mb-10 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-card/70 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/5 backdrop-blur scrollbar-none"
      >
        {EXPERIENCES.map((e, i) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            id={`experience-tab-${e.id}`}
            aria-selected={i === active}
            aria-controls={`experience-panel-${e.id}`}
            onClick={() => setActive(i)}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              i === active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {e.tab}
          </button>
        ))}
      </div>

      <div
        id={`experience-panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`experience-tab-${current.id}`}
        className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16"
      >
        <div className="flex min-w-0 justify-center lg:justify-start">
          <Visual key={current.id} className="w-full max-w-[560px]" />
        </div>
        <div key={current.id} className="landing-fade flex flex-col items-start gap-4">
          <h3 className="text-[24px] leading-[1.2] font-medium tracking-[-0.02em] text-foreground sm:text-[28px]">
            {current.title}
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            {current.body}
          </p>
          <Link
            href={`/app?view=${current.view}`}
            className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-primary underline-offset-4 hover:underline"
          >
            Try it
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </Section>
  );
}
