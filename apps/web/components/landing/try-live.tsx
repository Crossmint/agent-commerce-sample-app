import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Plug, Terminal } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import { cn } from "@/lib/cn";
import { INSTALL_URL, MCP_URL } from "./links";
import { MaskLogo } from "./mask-logo";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";
import { ChatDemo, CopyChip } from "./try-live-bits";

/**
 * Section `#try`: one card per way in. Any MCP host (Grok Bot and ChatGPT
 * included, until they get native connectors), terminal agents through the
 * CLI and skill, and our example chat. Every card has the same bones: a tile and a title, the
 * agents it fits when there are several, one line when it needs one, and
 * one action at the bottom.
 */
export function TryLive() {
  return (
    <Section id="try">
      <SectionHeading title="Try it live" sub="Pick the agent you already use." />
      <div className="grid gap-4 lg:grid-cols-6">
        <Card
          title="MCP server"
          tile={<Plug className="size-5" />}
          marks={[
            { name: "Grok Bot", logo: "/logos/grok-bot.svg" },
            { name: "ChatGPT", logo: "/logos/openai.svg" },
            { name: "Claude", logo: "/logos/claude.svg" },
            { name: "Claude Code", logo: "/logos/claude-code.svg" },
            { name: "Cursor", logo: "/logos/cursor.svg" },
          ]}
          lead="Any agent that speaks MCP. Paste the URL; OAuth does the rest."
          className="lg:col-span-3"
          delay={0}
        >
          <CopyChip text={MCP_URL} />
        </Card>

        <Card
          title="CLI and skill"
          tile={<Terminal className="size-5" />}
          marks={[
            { name: "eve", logo: "/logos/eve.svg" },
            { name: "OpenClaw", logo: "/logos/openclaw.svg" },
            { name: "Hermes", logo: "/logos/hermes-agent.png" },
          ]}
          lead="For agents in a terminal. Paste this line into your agent and it sets itself up."
          className="lg:col-span-3"
          delay={60}
        >
          <CopyChip text={`Set up ${INSTALL_URL}`} />
        </Card>

        <Card
          title="Our example chat"
          tile={<Image src="/brand/agents/crossmint-agents-mark.svg" alt="" width={24} height={24} className="size-6" />}
          lead="Our own agent chat, with GOAT components inline. This is what your users would see if you build the wallet into your product."
          className="lg:col-span-6"
          delay={120}
          aside={<ChatDemo className="rounded-md border border-border bg-muted p-3 sm:p-4" />}
        >
          <Button asChild className="w-full justify-between sm:w-auto sm:min-w-[11rem]">
            <Link href="/chat">
              Open the chat <ArrowRight />
            </Link>
          </Button>
        </Card>
      </div>
    </Section>
  );
}

interface Mark {
  name: string;
  logo: string;
}

function Card({
  title,
  tile,
  marks,
  lead,
  children,
  aside,
  className,
  delay,
}: {
  title: string;
  /** The mark or icon in the tile next to the title. */
  tile: ReactNode;
  /** Agents this way in fits, when there are several. */
  marks?: Mark[];
  lead?: string;
  children: ReactNode;
  /** A demo on the right, for the wide card. */
  aside?: ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className={cn("flex min-w-0", className)}>
      <article className={cn("landing-bento flex w-full min-w-0 flex-col gap-5 rounded-md border border-border bg-card p-6 sm:p-7", aside && "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:items-stretch md:gap-10")}>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground">{tile}</span>
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
            </div>
            {marks ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Works with">
                {marks.map((m) => (
                  <li key={m.name} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[12px] font-semibold text-foreground">
                    <MaskLogo src={m.logo} label="" className="size-3.5" />
                    {m.name}
                  </li>
                ))}
              </ul>
            ) : null}
            {lead ? <p className="text-base leading-snug text-muted-foreground">{lead}</p> : null}
          </header>
          <div className="mt-auto flex min-w-0 flex-col items-start gap-3 pt-1">{children}</div>
        </div>
        {aside}
      </article>
    </Reveal>
  );
}
