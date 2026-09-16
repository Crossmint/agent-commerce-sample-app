import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { AgentCardsDemo } from "./agent-cards-demo";
import { CheckoutRunMock } from "./checkout-run-mock";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const cards = [
  "Tools, components, and an example of how your agent asks for access to a user's card.",
  "Save your user's card in a PCI-compliant vault.",
  "Use agentic tokenization protocols, so your agents never see the card number.",
];

const checkouts = [
  "Buy from millions of merchants with one API call.",
  "Log in to any merchant securely, and keep sessions alive and safe.",
  "Save user profiles to check out faster.",
  "Pay with any method: saved cards your agent holds, Shop Pay, or cards saved on the store you're buying from.",
];

/** The two pieces of the template, each with its live mock. */
export function CorePieces() {
  return (
    <Section id="how" className="border-t border-border/70">
      <SectionHeading title="Two core pieces" />
      <div className="flex flex-col gap-24 sm:gap-32">
        <Block index="01" title="Agent Cards" bullets={cards} visual={<AgentCardsDemo />} />
        <Block index="02" title="Agent Checkouts" bullets={checkouts} visual={<CheckoutRunMock />} flip />
      </div>
    </Section>
  );
}

function Block({ index, title, bullets, visual, flip = false }: { index: string; title: string; bullets: string[]; visual: ReactNode; flip?: boolean }) {
  return (
    <article className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <Reveal className={cn("flex flex-col gap-6", flip && "lg:order-2")}>
        <p className="font-mono text-sm font-semibold tracking-wider text-primary">{index}</p>
        <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h3>
        <ul className="flex flex-col gap-3.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-primary/15 text-primary">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="text-base leading-snug text-foreground/90 sm:text-lg">{b}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={120} className={cn("min-w-0", flip && "lg:order-1")}>
        {visual}
      </Reveal>
    </article>
  );
}
