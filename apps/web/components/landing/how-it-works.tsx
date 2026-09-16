import type { ReactNode } from "react";
import { ApproveScreenMock } from "./approve-screen-mock";
import { MessageThreadMock } from "./message-thread-mock";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const frames: { caption: string; node: ReactNode }[] = [
  {
    caption: "Ask",
    node: <MessageThreadMock style="imessage" variant="request" label="An iMessage thread: the agent asks for $8 and sends an approval link" />,
  },
  {
    caption: "Approve on your platform",
    node: <ApproveScreenMock domain="yourplatform.com" />,
  },
  {
    caption: "Done",
    node: <MessageThreadMock style="whatsapp" variant="confirmation" label="A WhatsApp thread: the agent confirms the order and sends the receipt" />,
  },
];

export function HowItWorks() {
  return (
    <Section id="how" className="border-t border-border/70">
      <SectionHeading title="How users experience agentic payments" />
      <ol className="grid gap-12 sm:grid-cols-3 sm:gap-6">
        {frames.map((f, i) => (
          <li key={f.caption} className="flex flex-col items-center gap-6">
            <Reveal delay={i * 100} className="flex w-full flex-col items-center gap-6">
              <div className="w-full max-w-[280px]">{f.node}</div>
              <p className="text-center text-lg font-semibold tracking-tight">{f.caption}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
