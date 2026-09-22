"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { LandingPhone } from "./landing-phone";
import { AgentChatScreen, CHECKOUT_T, checkoutThread } from "./screen-chat";
import { APPROVE_FULL_END, ApproveScreen } from "./screen-approve";
import { CARDS_END, CardsScreen } from "./screen-cards";
import { Section, SectionHeading } from "./section";
import { ScreenStack, useActivationKeys } from "./step-ui";
import { useInView } from "./use-in-view";
import { useReducedMotion } from "./use-step-loop";

/*
 * Section `#how`: the phone on the left, three steps on the right. One step
 * is open at a time; opening a step switches the phone to its screen. The
 * phone also walks the steps on its own while in view, and holds off for a
 * while after the reader has picked one. Clicking the open step replays it
 * from the start.
 */

/** How long each step's screen holds, ms: its timeline plus a beat to read the result. */
const STEP_MS = [CARDS_END + 1000, APPROVE_FULL_END + 300, CHECKOUT_T.receipt + 1600];
const HOLD_AFTER_CLICK_MS = 12000;

interface Step {
  title: string;
  summary: string;
  body: string;
  facts: string[];
}

const STEPS: Step[] = [
  {
    title: "Save cards in a PCI vault",
    summary: "The card goes to Crossmint, never to your servers.",
    body: "Crossmint's payment method component saves the card straight into Crossmint's PCI vault. Your app only ever holds a token and the last four digits.",
    facts: [
      "The card number never touches your servers.",
      "Registered for agentic tokenization with Visa Intelligent Commerce and Mastercard Agent Pay.",
      "One component, dropped into your own page.",
    ],
  },
  {
    title: "Create mandates and spending limits",
    summary: "The agent asks for a budget. The user approves it once.",
    body: "The agent asks for an agent card, which Crossmint calls an order intent: an amount, a purpose, an expiry, and an optional merchant lock. The user approves once, on a screen your platform hosts.",
    facts: [
      "The network mints a scoped token per merchant and enforces the limit.",
      "Visa Intelligent Commerce and Mastercard Agent Pay.",
      "Revocable at any time.",
    ],
  },
  {
    title: "Check out anywhere with one API call",
    summary: "A product URL and the agent card. Crossmint does the rest.",
    body: "Agent Checkouts: one call with a product URL and the agent card. Crossmint drives the store's checkout in a real browser, pays with the agent card, asks the user only for what it cannot fill, and returns a receipt.",
    facts: [
      "Works with millions of merchants and Shop Pay.",
      "Uses cards the user already has saved at a store.",
      "Shipping, size and other gaps come back as questions.",
    ],
  },
];

export function HowItWorks() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  // Each pick bumps `picks`; the effect below stamps the time it saw it, so
  // the clock read stays out of render.
  const [picks, setPicks] = useState(0);
  const seenPicks = useRef(0);
  const holdUntil = useRef(0);
  const keys = useActivationKeys(step, cycle, STEPS.length);
  const wasOut = useRef(false);

  // Start over when the section comes back into view.
  useEffect(() => {
    if (inView === false) wasOut.current = true;
    if (inView === true && wasOut.current) {
      wasOut.current = false;
      setStep(0);
      setCycle((c) => c + 1);
    }
  }, [inView]);

  // Auto-advance while in view, unless the reader picked a step recently.
  useEffect(() => {
    if (picks !== seenPicks.current) {
      seenPicks.current = picks;
      holdUntil.current = Date.now() + HOLD_AFTER_CLICK_MS;
    }
    if (reduce || inView !== true) return;
    const remaining = holdUntil.current - Date.now();
    const id = window.setTimeout(
      () => {
        holdUntil.current = 0;
        setStep((s) => (s + 1) % STEPS.length);
      },
      remaining > 0 ? remaining : (STEP_MS[step] ?? 6500),
    );
    return () => window.clearTimeout(id);
  }, [step, cycle, picks, inView, reduce]);

  const pick = (i: number) => {
    setPicks((n) => n + 1);
    if (i === step) {
      // Replay the same screen.
      setCycle((c) => c + 1);
    } else {
      setStep(i);
    }
  };

  return (
    <Section id="how">
      <SectionHeading
        title="How it works"
        sub="Three APIs, one approval screen you host. The phone plays each step."
      />
      <div
        ref={ref}
        className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16"
      >
        <div className="flex justify-center lg:sticky lg:top-28 lg:justify-start">
          <LandingPhone label={`The phone shows step ${step + 1}: ${STEPS[step]?.title ?? ""}`}>
            <ScreenStack active={step}>
              <CardsScreen key={keys[0]} />
              <ApproveScreen key={keys[1]} state="full" />
              <AgentChatScreen key={keys[2]} messages={checkoutThread()} />
            </ScreenStack>
          </LandingPhone>
        </div>

        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => {
            const open = i === step;
            return (
              <li key={s.title}>
                <div
                  className={cn(
                    "rounded-2xl bg-card ring-1 ring-foreground/10 transition-colors",
                    open ? "bg-card" : "bg-card/60 hover:bg-card",
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`how-step-${i}`}
                    onClick={() => pick(i)}
                    className="flex w-full items-start gap-4 rounded-2xl p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors",
                        open
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[17px] leading-snug font-medium tracking-[-0.01em] text-foreground sm:text-lg">
                        {s.title}
                      </span>
                      {/* The summary folds away when the step opens, so the body starts right under the title. */}
                      <span className="landing-fold" data-open={!open}>
                        <span className="text-[15px] leading-snug text-muted-foreground">
                          {s.summary}
                        </span>
                      </span>
                    </span>
                  </button>
                  <div
                    id={`how-step-${i}`}
                    className="landing-fold"
                    data-open={open}
                    inert={!open || undefined}
                  >
                    <div>
                      <div className="flex flex-col gap-4 px-5 pb-5 pl-16 sm:px-6 sm:pb-6 sm:pl-[68px]">
                        <p className="text-[15px] leading-relaxed text-muted-foreground">
                          {s.body}
                        </p>
                        <ul className="flex flex-col gap-2">
                          {s.facts.map((f) => (
                            <li
                              key={f}
                              className="flex items-start gap-2.5 text-[14px] leading-snug text-foreground"
                            >
                              <span
                                aria-hidden
                                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary"
                              />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}
