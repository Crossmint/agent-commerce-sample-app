import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { AdaptersPanel } from "./adapters-panel";
import { AgentCardsDemo } from "./agent-cards-demo";
import { CheckoutRunMock } from "./checkout-run-mock";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const cards: ReactNode[] = [
  "Tools, components, and an example of how your agent asks for access to a user's card.",
  "Save your user's card in a PCI-compliant vault.",
  "Use agentic tokenization protocols, so your agents never see the card number.",
];

const checkouts: ReactNode[] = [
  "Buy from millions of merchants with one API call.",
  "Log in to any merchant securely, and keep sessions alive and safe.",
  "Save user profiles to check out faster.",
  "Pay with any method: saved cards your agent holds, Shop Pay, or cards saved on the store you're buying from.",
];

const adapters: ReactNode[] = [
  <Item key="tools" title="Agent tools">
    Typed tools your agent calls directly, in process.
  </Item>,
  <Item key="mcp" title="MCP server">
    One endpoint with OAuth for ChatGPT, Claude, and any MCP host.
  </Item>,
  <Item key="cli" title="Your own CLI and skills">
    Ship a branded CLI and a skill for Claude Code, OpenClaw, and Hermes.
  </Item>,
];

/** The three pieces of the template, each with its live mock. Text in a white card, the visual centered on a mint panel; they alternate sides. */
export function CorePieces() {
  return (
    <Section id="how">
      <SectionHeading title="Three core pieces" />
      <div className="flex flex-col gap-10 sm:gap-14">
        <Block index="01" title="Agent Cards" bullets={cards} visual={<AgentCardsDemo className="mx-auto w-full max-w-[var(--phone-w)]" />} />
        <Block index="02" title="Agent Checkouts" bullets={checkouts} visual={<CheckoutRunMock className="mx-auto w-full max-w-[var(--phone-w)]" />} flip />
        <Block index="03" title="Adapters for any agent framework" bullets={adapters} visual={<AdaptersPanel className="mx-auto w-full max-w-[520px]" />} />
      </div>
    </Section>
  );
}

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <span className="font-semibold text-foreground">{title}.</span> {children}
    </>
  );
}

function Block({ index, title, bullets, visual, flip = false }: { index: string; title: string; bullets: ReactNode[]; visual: ReactNode; flip?: boolean }) {
  return (
    <article className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
      <Reveal className={cn("flex flex-col justify-center gap-6 rounded-lg border border-border bg-card p-6 sm:p-10", flip && "lg:order-2")}>
        <p className="font-mono text-sm font-semibold tracking-wider text-primary">{index}</p>
        <h3 className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">{title}</h3>
        <ul className="flex flex-col gap-3.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary/15 text-primary">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="text-base leading-snug text-foreground/85 sm:text-lg">{b}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={120} className={cn("flex min-w-0 items-center justify-center rounded-lg bg-muted px-3 py-10 sm:px-10 sm:py-14", flip && "lg:order-1")}>
        <div className="w-full">{visual}</div>
      </Reveal>
    </article>
  );
}
