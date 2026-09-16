import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge, Button } from "@goat-wallet/ui";
import { STEPS } from "./how-it-works";
import { DOCS_URL } from "./links";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const agents = ["ChatGPT", "Grok", "Claude (MCP)", "Claude Code CLI + skill", "OpenClaw", "Hermes", "Example chat"];

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
            <header className="flex flex-col gap-2">
              <h3 className="text-3xl font-bold tracking-tight">I want to try it</h3>
              <p className="text-lg text-muted-foreground">Buy a Starbucks coffee with your agent in three steps.</p>
            </header>
            <ol className="flex flex-col gap-5">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold">{step.title}</p>
                    {i === 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {agents.map((a) => (
                          <Badge key={a} variant="outline" className="px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{step.text}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-auto pt-2">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/chat">
                  Open the example chat <ArrowRight />
                </Link>
              </Button>
            </div>
          </article>
        </Reveal>

        <Reveal delay={100} className="flex">
          <article id="developers" className="flex w-full scroll-mt-24 flex-col gap-7 rounded-3xl border border-border bg-card p-6 sm:p-9">
            <header className="flex flex-col gap-2">
              <h3 className="text-3xl font-bold tracking-tight">I&apos;m building an agent or platform</h3>
              <p className="text-lg text-muted-foreground">
                Use the Crossmint APIs behind GOAT to add saved cards, agent budgets, and checkouts to your product. Copy the parts
                you need.
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
            <div className="goat-window">
              <pre className="flex flex-col gap-1 p-4 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap text-foreground">
                <code className="block pl-5 -indent-5">
                  <span className="text-muted-foreground select-none">$ </span>npm i -g goat
                </code>
                <code className="block pl-5 -indent-5">
                  <span className="text-muted-foreground select-none">$ </span>goat agent-card request --amount 5 --description{" "}
                  <span className="text-primary">&quot;Starbucks&quot;</span>
                </code>
              </pre>
            </div>
            <div className="mt-auto pt-2">
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href={DOCS_URL} target="_blank" rel="noreferrer">
                  Get started on GitHub <ArrowRight />
                </a>
              </Button>
            </div>
          </article>
        </Reveal>
      </div>
    </Section>
  );
}
