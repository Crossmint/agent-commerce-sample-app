import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import { cn } from "@/lib/cn";
import { CONNECTOR_URLS, INSTALL_URL, MCP_URL } from "./links";
import { MaskLogo } from "./mask-logo";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";
import { ChatDemo, CopyChip } from "./try-live-bits";

/**
 * Section `#try`: one card per way in. Grok Bot, ChatGPT, any MCP host,
 * terminal agents through the CLI and skill, and our example chat. Each
 * card is a logo, one line, and one action.
 */
export function TryLive() {
  return (
    <Section id="try">
      <SectionHeading title="Try it live" sub="Pick the agent you already use." />
      <div className="grid gap-4 lg:grid-cols-6">
        <Card
          title="Grok Bot"
          logo="/logos/grok-bot.svg"
          lead="Install the GOAT plugin. It brings the tools, the skill, and a payments rule."
          className="lg:col-span-2"
          delay={0}
        >
          <Button asChild variant="outline" className="w-full justify-between sm:w-auto">
            <a href={CONNECTOR_URLS.grokBot} target="_blank" rel="noreferrer">
              Get the plugin <ArrowUpRight />
            </a>
          </Button>
        </Card>

        <Card
          title="ChatGPT"
          logo="/logos/openai.svg"
          lead="Add GOAT as a connector with this URL. ChatGPT signs you in the first time."
          className="lg:col-span-2"
          delay={40}
        >
          <CopyChip text={MCP_URL} />
          <a href={CONNECTOR_URLS.chatgpt} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
            Open ChatGPT connectors <ArrowUpRight className="size-3.5" />
          </a>
        </Card>

        <Card
          title="MCP servers"
          logos={[
            { name: "Claude", logo: "/logos/claude.svg" },
            { name: "Claude Code", logo: "/logos/claude-code.svg" },
            { name: "Cursor", logo: "/logos/cursor.svg" },
          ]}
          lead="Any agent that speaks MCP. Paste the URL; OAuth does the rest."
          className="lg:col-span-2"
          delay={80}
        >
          <CopyChip text={MCP_URL} />
        </Card>

        <Card
          title="CLI and skill"
          logos={[
            { name: "eve", logo: "/logos/eve.svg" },
            { name: "OpenClaw", logo: "/logos/openclaw.svg" },
            { name: "Hermes", logo: "/logos/hermes.svg" },
          ]}
          lead="For agents in a terminal. Paste this line into your agent and it sets itself up."
          className="lg:col-span-2"
          delay={120}
        >
          <CopyChip text={`Set up ${INSTALL_URL}`} />
        </Card>

        <Card
          title="The example chat"
          logo="/brand/agents/crossmint-agents-mark.svg"
          colored
          lead="Our own agent chat, with GOAT components inline. This is what your users would see if you build the wallet into your product."
          className="lg:col-span-4"
          delay={160}
          aside={<ChatDemo className="rounded-md border border-border bg-muted p-3 sm:p-4" />}
        >
          <Button asChild size="lg">
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
  lead,
  logo,
  colored,
  logos,
  children,
  aside,
  className,
  delay,
}: {
  title: string;
  lead: string;
  /** One agent: its mark in a tile next to the title. */
  logo?: string;
  colored?: boolean;
  /** Several agents: small marks in a row under the title. */
  logos?: Mark[];
  children: ReactNode;
  /** A demo on the right, for the wide card. */
  aside?: ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className={cn("flex min-w-0", className)}>
      <article className={cn("landing-bento flex w-full min-w-0 flex-col gap-5 rounded-md border border-border bg-card p-6 sm:p-7", aside && "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:items-center md:gap-10")}>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {logo ? (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground">
                  {colored ? <Image src={logo} alt="" width={24} height={24} className="size-6" /> : <MaskLogo src={logo} label="" className="size-6" />}
                </span>
              ) : null}
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
            </div>
            {logos ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Works with">
                {logos.map((m) => (
                  <li key={m.name} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[12px] font-semibold text-foreground">
                    <MaskLogo src={m.logo} label="" className="size-3.5" />
                    {m.name}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-base leading-snug text-muted-foreground">{lead}</p>
          </header>
          <div className="mt-auto flex min-w-0 flex-col items-start gap-3">{children}</div>
        </div>
        {aside}
      </article>
    </Reveal>
  );
}
