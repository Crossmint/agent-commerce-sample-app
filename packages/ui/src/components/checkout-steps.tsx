"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import type { CheckoutMessage } from "@agent-commerce/core";
import type { CheckoutView } from "../api/types.js";
import { cn } from "../lib/utils.js";

export type CheckoutStepState = "done" | "active" | "waiting" | "failed";

export interface CheckoutStep {
  key: string;
  label: string;
  state: CheckoutStepState;
}

const RUNNING = new Set(["queued", "running"]);

/**
 * What the user sent for each question, in a few words: their alternative,
 * or "Skipped". The transcript keeps which fields a submit answered, never
 * their values, so a submit adds nothing.
 */
function answersOf(messages: CheckoutMessage[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type !== "input_response" || typeof part.requestId !== "string") continue;
      if (part.action === "decline") out.set(part.requestId, "Skipped");
      else if (part.action === "alternative" && typeof part.text === "string")
        out.set(part.requestId, part.text);
    }
  }
  return out;
}

/**
 * The run as a list of steps, from its transcript: each progress report the
 * agent wrote, and each question it asked. While the run works, its newest
 * step is the one in progress. An open question waits on the user.
 *
 * The card form is never a step of its own: it reads as the payment step,
 * which the user answers by choosing a payment method.
 */
export function checkoutSteps(
  messages: CheckoutMessage[],
  view: Pick<CheckoutView, "status" | "paymentRequest">,
): CheckoutStep[] {
  const steps: CheckoutStep[] = [];
  const questions = new Map<string, number>();
  const awaiting = view.status === "awaiting_input";
  const answers = answersOf(messages);

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (part.type === "progress" && typeof part.text === "string") {
        const label = part.text.trim();
        if (!label || steps.at(-1)?.label === label) continue;
        steps.push({ key: `${message.id}-${steps.length}`, label, state: "done" });
        continue;
      }
      if (part.type === "input_request" && typeof part.requestId === "string") {
        const open = part.status === "open";
        const interaction = part.interaction as { kind?: string } | undefined;
        // Only the payment request: a form asking for card details is a question.
        const payment = interaction?.kind === "payment";
        const step: CheckoutStep = {
          key: part.requestId,
          label: payment
            ? open
              ? "Reached the payment step"
              : "Paid with your agent card"
            : answerLine(
                String(part.question ?? "A question for you"),
                open ? undefined : answers.get(part.requestId),
              ),
          state: open ? (awaiting ? "waiting" : "active") : "done",
        };
        // A request can appear in more than one revision. The newest wins, in its first place.
        const at = questions.get(part.requestId);
        if (at === undefined) {
          questions.set(part.requestId, steps.length);
          steps.push(step);
        } else {
          steps[at] = step;
        }
      }
    }
  }

  if (view.paymentRequest && !steps.some((s) => s.state === "waiting")) {
    steps.push({ key: "payment", label: "Choose a payment method", state: "waiting" });
  }

  if (RUNNING.has(view.status) || (awaiting && !steps.some((s) => s.state === "waiting"))) {
    const last = steps.at(-1);
    if (!last) steps.push({ key: "start", label: "Opening the store", state: "active" });
    else if (last.state === "done" && !questions.has(last.key)) last.state = "active";
    // Just past an answered question: the agent is back at work, with nothing new to say yet.
    else if (last.state === "done")
      steps.push({ key: "working", label: "Carrying on", state: "active" });
  }

  if (view.status === "failed" || view.status === "blocked") {
    const last = steps.at(-1);
    if (last && last.state !== "done") last.state = "failed";
  }

  return steps;
}

/** "Which size do you want? US 10". The answer goes after the question it closed. */
function answerLine(question: string, answer: string | undefined): string {
  return answer ? `${question} ${answer}` : question;
}

export interface CheckoutStepsProps {
  steps: CheckoutStep[];
  className?: string;
}

/**
 * What the agent is doing, one line per step. Each new step slides in, and
 * its mark turns into a tick when the agent moves on.
 */
export function CheckoutSteps({ steps, className }: CheckoutStepsProps) {
  if (!steps.length) return null;
  return (
    <ol className={cn("flex flex-col gap-2.5", className)} aria-label="Checkout progress">
      {steps.map((step) => (
        <li
          key={step.key}
          className="flex items-start gap-2.5 text-sm leading-snug duration-300 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          <StepMark state={step.state} />
          <span
            className={cn(
              "min-w-0 flex-1 break-words",
              step.state === "done" ? "text-foreground" : "text-muted-foreground",
              step.state === "waiting" && "font-medium text-foreground",
              step.state === "failed" && "text-destructive",
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StepMark({ state }: { state: CheckoutStepState }) {
  const base = "mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full";
  switch (state) {
    case "done":
      return (
        <span
          aria-label="Done"
          className={cn(
            base,
            "bg-primary text-primary-foreground duration-200 animate-in zoom-in-50 motion-reduce:animate-none",
          )}
        >
          <Check className="size-3" strokeWidth={3.5} />
        </span>
      );
    case "failed":
      return (
        <span
          aria-label="Failed"
          className={cn(base, "bg-destructive text-destructive-foreground")}
        >
          <X className="size-3" strokeWidth={3.5} />
        </span>
      );
    case "waiting":
      return (
        <span aria-label="Waiting for you" className={cn(base, "ring-[1.5px] ring-warning")}>
          <span className="size-2 animate-pulse rounded-full bg-warning motion-reduce:animate-none" />
        </span>
      );
    default:
      return (
        <span aria-label="In progress" className={base}>
          <svg
            viewBox="0 0 24 24"
            className="size-full animate-spin text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
        </span>
      );
  }
}
