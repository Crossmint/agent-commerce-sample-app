import type { ReactNode } from "react";
import { CreditCard, ShieldCheck, ShoppingBag } from "lucide-react";
import { CostCompare } from "./cost-compare";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const pillars: { icon: ReactNode; title: string; text: string; extra?: ReactNode }[] = [
  {
    icon: <ShieldCheck />,
    title: "A way to save cards securely",
    text: "Users add a card once. Crossmint keeps it in a PCI vault. Your servers never touch a number.",
  },
  {
    icon: <CreditCard />,
    title: "A way to tokenize them so agents get proper limits",
    text:
      "Agents get a bounded budget on the user's own card through Visa Intelligent Commerce and Mastercard Agent Pay. No one-time virtual cards, so refunds and disputes work like any other purchase.",
  },
  {
    icon: <ShoppingBag />,
    title: "Tools to check out from millions of stores",
    text: "Agent Checkouts buys from any store in about 2 minutes instead of 10, for roughly $0.05 in tokens instead of $1.",
    extra: <CostCompare />,
  },
];

export function Pillars() {
  return (
    <Section id="includes" className="border-t border-border/70">
      <SectionHeading title="This template includes" />
      <div className="grid gap-5 md:grid-cols-3">
        {pillars.map((p, i) => (
          <Reveal key={p.title} delay={i * 90} className="flex">
            <article className="flex w-full flex-col gap-5 rounded-3xl border border-border bg-card p-6 sm:p-7">
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary [&_svg]:size-5">
                {p.icon}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-bold tracking-tight text-balance">{p.title}</h3>
                <p className="text-muted-foreground">{p.text}</p>
              </div>
              {p.extra ? <div className="mt-auto pt-1">{p.extra}</div> : null}
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
