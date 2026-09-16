import type { ReactNode } from "react";
import { ApproveScreenMock } from "./approve-screen-mock";
import { ConfirmationMock, MessageThreadMock } from "./message-thread-mock";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

export const STEPS = [
  {
    title: "Add GOAT to your agent",
    text: "Works with ChatGPT, Grok, Claude (MCP), the CLI plus skill for Claude Code, OpenClaw and Hermes, or our example chat.",
  },
  {
    title: "Ask for something",
    text: "Your agent asks to use your card. You approve once, with a limit.",
  },
  {
    title: "Enjoy what you bought",
    text: "The agent completes the checkout and sends you the receipt.",
  },
] as const;

const frames: ReactNode[] = [
  <MessageThreadMock key="thread" variant="request" />,
  <ApproveScreenMock key="approve" />,
  <ConfirmationMock key="done" />,
];

export function HowItWorks() {
  return (
    <Section id="how" className="border-t border-border/70">
      <SectionHeading title="How it works" sub="Buy a Starbucks coffee with your agent in three steps." />
      <ol className="relative grid gap-14 lg:grid-cols-3 lg:gap-8">
        {/* The timeline line: vertical on phones, horizontal on desktop. */}
        <div
          aria-hidden
          className="absolute top-0 bottom-0 left-[1.4rem] w-px bg-border lg:top-[1.4rem] lg:right-[16%] lg:bottom-auto lg:left-[16%] lg:h-px lg:w-auto"
        />
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative flex flex-col gap-6 pl-16 lg:items-center lg:pl-0 lg:text-center">
            <Reveal delay={i * 100} className="flex flex-col gap-6 lg:items-center">
              <span className="absolute top-0 left-0 inline-flex size-11 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground ring-8 ring-background lg:static">
                {i + 1}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-bold tracking-tight">{step.title}</h3>
                <p className="max-w-sm text-muted-foreground">{step.text}</p>
              </div>
              <div className="w-full pt-2">{frames[i]}</div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
