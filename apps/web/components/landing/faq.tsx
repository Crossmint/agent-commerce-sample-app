"use client";

import { type ReactNode, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Section, SectionHeading } from "./section";

/*
 * Section `#faq`. Not `<details>`: a closed disclosure sets its panel to
 * `display: none`, and nothing animates from that. These are controlled, so
 * the panel opens and closes on the `.landing-fold` row transition, the same
 * one `how-it-works` uses, and the mark turns as it goes. Each question
 * toggles on its own — a reader comparing two answers should not lose one to
 * open the other.
 */

interface Question {
  q: string;
  /** The lead paragraph. */
  a: ReactNode;
  /** Reasons under the lead, when one paragraph would not carry them. */
  points?: string[];
}

const QUESTIONS: Question[] = [
  {
    q: "How is this different from Stripe Link?",
    a: "Link is a platform your users log into. This is a white-label experience embedded in your own app.",
    points: [
      "It stays your app: your users, your design, no second login and no hand-off to somebody else's platform.",
      "These are agent cards, not the one-time-use cards Link issues. They run on Visa Intelligent Commerce and Mastercard Agent Pay.",
      "They are your users' own cards, scoped and enforced at the network level, so your users keep their points and rewards.",
      "Bank statements read as the merchant charging them directly, not as a Stripe charge.",
      "Refunds and chargebacks go straight to the merchant, with no Stripe in the middle.",
    ],
  },
  {
    q: "Which card networks are supported?",
    a: "Visa Intelligent Commerce and Mastercard Agent Pay for enforced limits, plus an encrypted-card fallback where the limit is advisory. Union Pay and AMEX are coming.",
  },
  {
    q: "Is it production ready?",
    a: "It is a sample app. It runs against production Crossmint keys and real cards, and it shows the flows end to end, but review it before shipping it to your users.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <Section id="faq">
      <SectionHeading title="Questions" />
      <div className="flex max-w-3xl flex-col gap-3">
        {QUESTIONS.map(({ q, a, points }, i) => {
          const isOpen = Boolean(open[i]);
          return (
            <div key={q} className="rounded-2xl bg-card ring-1 ring-foreground/10">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${i}`}
                onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-[16px] leading-snug font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6 sm:text-[17px]"
              >
                {q}
                <Plus
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-45",
                  )}
                  strokeWidth={2.2}
                />
              </button>
              <div
                id={`faq-answer-${i}`}
                className="landing-fold"
                data-open={isOpen}
                inert={!isOpen || undefined}
              >
                <div>
                  <div className="flex flex-col gap-3 px-5 pb-5 sm:px-6">
                    <p className="text-[15px] leading-relaxed text-muted-foreground">{a}</p>
                    {points ? (
                      <ul className="flex flex-col gap-2">
                        {points.map((p) => (
                          <li
                            key={p}
                            className="flex items-start gap-2.5 text-[15px] leading-relaxed text-muted-foreground"
                          >
                            <span
                              aria-hidden
                              className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary"
                            />
                            {p}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
