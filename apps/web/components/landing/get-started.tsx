import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import { cn } from "@/lib/cn";
import { AGENT_LOGOS, type AgentLogo } from "./agent-logos";
import { BrandSwitcher } from "./brand-switcher";
import { DOCS_URL } from "./links";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const trySteps = ["Connect GOAT to your agent.", "Ask for something. Approve once, with a limit.", "The agent checks out and sends the receipt."];

const devBullets = [
  "Typed client for Crossmint Agents APIs",
  "Drop-in React approval screen",
  "MCP server and CLI for any agent",
  "Bring your own auth",
];

export function GetStarted() {
  return (
    <Section id="try" className="border-t border-border/70">
      <SectionHeading title="Two ways to start" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal className="flex">
          <article className="flex w-full flex-col gap-7 rounded-3xl border border-border bg-card p-6 sm:p-9">
            <h3 className="text-3xl font-bold tracking-tight">I want to try it</h3>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {AGENT_LOGOS.map((a) => (
                <li key={a.name} className={cn("flex", a.href ? "col-span-3 sm:col-span-2" : "")}>
                  <AgentTile agent={a} />
                </li>
              ))}
            </ul>
            <ol className="mt-auto flex flex-col gap-2 text-sm text-muted-foreground">
              {trySteps.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="w-4 shrink-0 font-semibold text-primary tabular-nums">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </article>
        </Reveal>

        <Reveal delay={100} className="flex">
          <article id="developers" className="flex w-full scroll-mt-24 flex-col gap-7 rounded-3xl border border-border bg-card p-6 sm:p-9">
            <header className="flex flex-col gap-2">
              <h3 className="text-3xl font-bold tracking-tight">I&apos;m building an agent or platform</h3>
              <p className="text-lg text-muted-foreground">
                Use Crossmint APIs to add saved cards, agent budgets, and checkouts to your product. Copy the parts you need from the GOAT
                template.
              </p>
            </header>
            <ul className="flex flex-col gap-3">
              {devBullets.map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="size-3.5" />
                  </span>
                  <span className="font-medium">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-2">
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href={DOCS_URL} target="_blank" rel="noreferrer">
                  Get started on GitHub <ArrowRight />
                </a>
              </Button>
            </div>
          </article>
        </Reveal>

        <Reveal delay={150} className="flex lg:col-span-2">
          <article id="brands" className="flex w-full scroll-mt-24 flex-col gap-8 rounded-3xl border border-border bg-card p-4 sm:p-9">
            <header className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">For builders</p>
              <h3 className="text-3xl font-bold tracking-tight">Make it yours</h3>
              <p className="text-lg text-muted-foreground">Same flow, your brand. Change colors, type, and layout.</p>
            </header>
            <BrandSwitcher />
          </article>
        </Reveal>
      </div>
    </Section>
  );
}

function AgentTile({ agent }: { agent: AgentLogo }) {
  const isGoat = Boolean(agent.href);
  const body = (
    <>
      <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-xl", isGoat ? "" : "bg-[#0c0c0c]")}>
        <Image
          src={agent.src}
          alt=""
          width={48}
          height={48}
          className={cn("object-contain", isGoat ? "size-12 rounded-full" : "size-6")}
        />
      </span>
      <span className={cn("flex min-w-0 flex-col leading-tight", isGoat ? "text-left" : "text-center")}>
        <span className="truncate text-sm font-semibold">{agent.name}</span>
        {agent.by ? <span className="truncate text-[11px] text-muted-foreground">{agent.by}</span> : null}
      </span>
      {isGoat ? <ArrowUpRight className="ml-auto size-4 shrink-0 text-primary" /> : null}
    </>
  );
  const cls = cn(
    "landing-tile flex w-full items-center gap-3 rounded-2xl border border-border bg-background/60 p-3",
    isGoat ? "flex-row border-primary/40" : "flex-col justify-center gap-2 px-2 py-4",
  );
  return agent.href ? (
    <Link href={agent.href} className={cn(cls, "outline-none focus-visible:ring-2 focus-visible:ring-ring/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
