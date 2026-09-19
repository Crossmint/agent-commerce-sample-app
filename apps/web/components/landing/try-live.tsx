import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import { cn } from "@/lib/cn";
import { CONNECTOR_URLS, INSTALL_URL, MCP_URL } from "./links";
import { MaskLogo } from "./mask-logo";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";
import { ChatDemo, ConnectorDemo, CopyChip } from "./try-live-bits";

/**
 * Section `#try`: four ways to give an agent a GOAT wallet, as a bento of
 * white cards. One sentence and one action each: a connector to open, a URL
 * to copy, a line to paste into the agent, a chat to try.
 */
export function TryLive() {
  return (
    <Section id="try">
      <SectionHeading title="Try it live" sub="Four ways in. Pick the one your agent already speaks." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BentoCard
          n="01"
          title="Native connectors"
          lead="Install GOAT as a plugin and the agent can pay. Pick your agent."
          agents={[
            { name: "Grok Bot", logo: "/logos/grok-bot.svg" },
            { name: "ChatGPT", logo: "/logos/openai.svg" },
          ]}
          className="lg:col-span-2"
          delay={0}
        >
          <ConnectorDemo
            className="max-w-xl"
            connectors={[
              { name: "Grok Bot", logo: "/logos/grok-bot.svg", href: CONNECTOR_URLS.grokBot },
              { name: "ChatGPT", logo: "/logos/openai.svg", href: CONNECTOR_URLS.chatgpt },
            ]}
          />
        </BentoCard>

        <BentoCard
          n="02"
          title="MCP server"
          lead="One URL with OAuth. Paste it into any agent that speaks MCP."
          agents={[
            { name: "Claude", logo: "/logos/claude.svg" },
            { name: "Claude Code", logo: "/logos/claude-code.svg" },
            { name: "Cursor", logo: "/logos/cursor.svg" },
          ]}
          delay={60}
        >
          <CopyChip text={MCP_URL} />
        </BentoCard>

        <BentoCard
          n="03"
          title="CLI and skill"
          lead="For agents that live in a terminal. Paste this line into your agent."
          agents={[
            { name: "eve", logo: "/logos/eve.svg" },
            { name: "OpenClaw", logo: "/logos/openclaw.svg" },
            { name: "Hermes", logo: "/logos/hermes.svg" },
          ]}
          delay={90}
        >
          <CopyChip text={`Set up ${INSTALL_URL}`} />
        </BentoCard>

        <BentoCard
          n="04"
          title="The example chat"
          lead="Our own agent chat, with GOAT components inline. This is what your users would see if you build the wallet into your product."
          agents={[{ name: "GOAT chat", logo: "/brand/agents/crossmint-agents-mark.svg", colored: true }]}
          className="lg:col-span-2"
          delay={120}
        >
          <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-center md:gap-10">
            <ChatDemo className="rounded-md border border-border bg-muted p-3 sm:p-4" />
            <div className="flex flex-col items-start gap-4">
              <p className="text-base leading-snug text-muted-foreground">Sign in, save a test card, and ask the agent to buy something. You approve in the thread.</p>
              <Button asChild size="lg">
                <Link href="/chat">
                  Open the chat <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </BentoCard>
      </div>
    </Section>
  );
}

interface AgentChip {
  name: string;
  logo: string;
  /** The file carries its own colors. Others are one color and take the text color. */
  colored?: boolean;
}

function BentoCard({
  n,
  title,
  lead,
  agents,
  children,
  className,
  delay,
}: {
  n: string;
  title: string;
  lead: string;
  agents: AgentChip[];
  children: ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className={cn("flex min-w-0", className)}>
      <article className="landing-bento flex w-full min-w-0 flex-col gap-6 rounded-md border border-border bg-card p-6 sm:p-7">
        <header className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <span className="font-mono text-xs font-semibold text-primary tabular-nums">{n}</span>
            <ul className="flex flex-wrap justify-end gap-1.5">
              {agents.map((a) => (
                <li key={a.name} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[12px] font-semibold text-foreground">
                  {a.colored ? <Image src={a.logo} alt="" width={14} height={14} className="size-3.5" /> : <MaskLogo src={a.logo} label="" className="size-3.5" />}
                  {a.name}
                </li>
              ))}
            </ul>
          </div>
          <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[1.75rem]">{title}</h3>
          <p className="max-w-2xl text-base leading-snug text-muted-foreground">{lead}</p>
        </header>
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-5">{children}</div>
      </article>
    </Reveal>
  );
}
