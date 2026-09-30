"use client";

import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { ChevronRight, CreditCard, Wallet, WalletCards, type LucideIcon } from "lucide-react";
import { canPayAtCheckout, type AgentCard } from "@agent-commerce/core";
import {
  ApproveAgentCard,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Skeleton,
  agentCardGroup,
  cn,
  errorMessage,
  formatAmount,
  useAgentCards,
  useAgentCommerce,
  type ApproveOutcome,
} from "@agent-commerce/ui";
import { PLATFORM_NAME } from "@/components/brand";
import { budgetQuestion } from "@/lib/chat/budget";
import {
  budgetFor,
  parsePrice,
  type Money,
  type PaymentChoiceMethod,
} from "@/lib/chat/payment-choice";
import type { FoundProduct } from "@/lib/chat/shopify-catalog";
import type { ApprovalOutcome, PaymentChoiceOutcome } from "@/lib/chat/tools";
import { APPROVAL_DONE_LINGER_MS, ApprovalInThread, approvalQuestion } from "./agent-card-approval";
import { BudgetChosen, BudgetPicker, budgetRequest, type BudgetPick } from "./budget-picker";
import { toApprovalOutcome } from "./parts";
import { ProductImage } from "./product-cards";
import { AgentBubble } from "./text";

/** What the model passed `await_payment_choice`. */
export interface PaymentChoiceInput {
  url: string;
  item: string;
  store?: string;
  price?: { amount: string; currency: string };
  /** What a new budget would cover: Clothing, Snacks. */
  category?: string;
}

/** The product the choice is for: what the agent said, filled in from the card the thread showed. */
export function choiceSubject(input: PaymentChoiceInput, product: FoundProduct | undefined) {
  const price = input.price ?? parsePrice(product?.price);
  return {
    item: input.item,
    store: input.store ?? product?.store,
    image: product?.image,
    price,
    budget: price ? budgetFor(price) : undefined,
  };
}

/** What the agent asks over the choice. */
export function paymentChoiceQuestion(item: string): string {
  return `How do you want to pay for the ${item}?`;
}

/**
 * The marks of the ways to pay, as stores show them among the ways they
 * take: from Shopify's payment icons (github.com/activemerchant/payment_icons).
 */
const LOGOS = {
  shopPay: "/icons/payments/shoppay.svg",
  paypal: "/icons/payments/paypal.svg",
  klarna: "/icons/payments/klarna.svg",
} as const;

/** How a way to pay is drawn: its own logo, or a plain mark. */
interface Mark {
  /** A plain mark, for a way with no logo of its own. */
  icon?: LucideIcon;
  /** The way's own logo, drawn as it comes. */
  logo?: string;
}

export interface PaymentOption extends Mark {
  method: PaymentChoiceMethod;
  /** Set for an agent card the user already has. */
  agentCardId?: string;
  /** Set for a named way under Another way: PayPal, Klarna. */
  name?: string;
  label: string;
  detail: string;
  /** Logos of the ways a row stands for, side by side at its end. */
  hints?: readonly string[];
}

/** One option's key, unique in its list: the card, the named way, else the way. */
export function optionKey(option: PaymentOption): string {
  return option.agentCardId ?? option.name ?? option.method;
}

/** "shop.example" from a URL or a bare domain. */
function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The agent cards the user already has that can pay for this as they are:
 * active, in the price's currency, with at least the price left, and not
 * locked to another store. A card with less than the budget may still pay,
 * when shipping and tax are low; `cardOptions` says so. Cards locked to this
 * store come first, then the ones that cover the whole budget, then the
 * ones with the most left. At most two.
 */
export function fittingCards(
  cards: AgentCard[] | undefined,
  url: string,
  subject: { price?: { amount: string; currency: string }; budget?: Money },
): AgentCard[] {
  if (!cards?.length) return [];
  const host = hostOf(url);
  const need = subject.price
    ? { value: subject.price.amount, currency: subject.price.currency }
    : subject.budget;
  const covers = (c: AgentCard) =>
    !subject.budget ||
    Number.parseFloat(c.amount.available) >= Number.parseFloat(subject.budget.value);
  return cards
    .filter((c) => agentCardGroup(c) === "active" && canPayAtCheckout(c))
    .filter((c) => !c.merchant || hostOf(c.merchant.url) === host)
    .filter((c) => {
      const left = Number.parseFloat(c.amount.available);
      if (!(left > 0)) return false;
      if (!need) return true;
      return (
        c.amount.currency.toUpperCase() === need.currency.toUpperCase() &&
        left >= Number.parseFloat(need.value)
      );
    })
    .sort(
      (a, b) =>
        Number(Boolean(b.merchant)) - Number(Boolean(a.merchant)) ||
        Number(covers(b)) - Number(covers(a)) ||
        Number.parseFloat(b.amount.available) - Number.parseFloat(a.amount.available),
    )
    .slice(0, 2);
}

/** A new budget from a saved card, with this purchase as its first. */
function newCardOption(label: string): PaymentOption {
  return {
    method: "card",
    label,
    detail: "Set a budget on a saved card, for this and similar purchases",
    icon: CreditCard,
  };
}

/** The three ways to pay, in order. Card and Another way each ask one more thing. */
export function paymentOptions(): PaymentOption[] {
  return [
    newCardOption("Card"),
    {
      method: "shop_pay",
      label: "Shop Pay",
      detail: "Sign in to your Shop account at checkout",
      logo: LOGOS.shopPay,
    },
    {
      method: "other",
      label: "Another way",
      detail: "PayPal, Klarna or another way the store takes",
      icon: Wallet,
      hints: [LOGOS.paypal, LOGOS.klarna],
    },
  ];
}

/** What Card asks when the user has agent cards that fit. */
export const CARD_STEP_QUESTION = "Use an agent card you already have?";

/** What Card's step says when the cards came in and none fits. */
const NO_CARD_FITS = "No agent card you have fits this store.";

/** Card, one step on: the agent cards that fit, which need no new approval, then a new one. */
export function cardOptions(budget: Money | undefined, cards: AgentCard[]): PaymentOption[] {
  return [
    ...cards.map((c): PaymentOption => {
      const left = formatAmount(c.amount.available, c.amount.currency);
      const covers =
        !budget || Number.parseFloat(c.amount.available) >= Number.parseFloat(budget.value);
      return {
        method: "agent_card",
        agentCardId: c.orderIntentId,
        label: c.description,
        detail: `${left} left${c.merchant ? `, for ${c.merchant.name}` : ""}. ${
          covers ? "No new approval." : "Might not cover shipping and tax."
        }`,
        icon: WalletCards,
      };
    }),
    newCardOption("New budget"),
  ];
}

/** What Another way asks. */
export const OTHER_STEP_QUESTION = "Which way do you want to pay?";

/** Another way, one step on: the ways most stores take. Anything else is typed. */
export function otherOptions(): PaymentOption[] {
  return [
    {
      method: "other",
      name: "PayPal",
      label: "PayPal",
      detail: "Sign in to PayPal at checkout",
      logo: LOGOS.paypal,
    },
    {
      method: "other",
      name: "Klarna",
      label: "Klarna",
      detail: "Pay later or in parts, if the store offers it",
      logo: LOGOS.klarna,
    },
  ];
}

/** Another way, with no name yet: typed in the field, or asked in words. */
export const SOMETHING_ELSE: PaymentOption = {
  method: "other",
  label: "Something else",
  detail: "Say which way, and the agent tells the store",
  icon: Wallet,
};

/**
 * The choice once the new budget's approval ended: approved, that card, for
 * the checkout; not approved, Card with how it ended, so the agent asks how
 * else to pay. Either way it carries the budget, so the thread draws it again.
 */
export function newBudgetOutcome(
  outcome: ApproveOutcome,
  pick: BudgetPick,
  requestId: string,
): PaymentChoiceOutcome {
  const agentCardId = outcome.agentCard?.orderIntentId ?? outcome.request.agentCardId;
  if (outcome.status === "active" && agentCardId) {
    return {
      method: "agent_card",
      agentCardId,
      newCard: true,
      requestId,
      approval: "active",
      name: pick.category,
      budget: pick.amount,
      ...(pick.days ? { days: pick.days } : {}),
    };
  }
  return {
    method: "card",
    requestId,
    approval: toApprovalOutcome(outcome).status,
    name: pick.category,
    budget: pick.amount,
    ...(pick.days ? { days: pick.days } : {}),
  };
}

/** The mark of an answer, for the choice once it is made. */
function markOf(outcome: PaymentChoiceOutcome): Mark {
  if (outcome.method === "agent_card") return { icon: outcome.newCard ? CreditCard : WalletCards };
  if (outcome.method === "card") return { icon: CreditCard };
  if (outcome.method === "shop_pay") return { logo: LOGOS.shopPay };
  const named = otherOptions().find((o) => o.name === outcome.name);
  return named ?? { icon: Wallet };
}

/** The choice in a few words, as the user's reply: "Card", "Shop Pay", "PayPal", the agent card's name. */
export function paymentChoiceLabel(outcome: PaymentChoiceOutcome): string {
  if (outcome.method === "card") return "Card";
  if (outcome.method === "shop_pay") return "Shop Pay";
  if (outcome.method === "agent_card" && outcome.newCard) {
    return outcome.budget
      ? `${outcome.name?.trim() || "Budget"}, up to ${formatAmount(outcome.budget.value, outcome.budget.currency)}`
      : "Card";
  }
  if (outcome.method === "agent_card") return outcome.name?.trim() || "My agent card";
  return outcome.name?.trim() || "Another way";
}

/** The tool output for a pick. The budget comes along, so the agent does no arithmetic. */
export function paymentChoiceOutcome(
  option: PaymentOption,
  budget: Money | undefined,
  typed?: string,
): PaymentChoiceOutcome {
  const name = option.agentCardId ? option.label : (option.name ?? typed?.trim());
  return {
    method: option.method,
    ...(option.agentCardId ? { agentCardId: option.agentCardId } : {}),
    ...(name ? { name } : {}),
    ...(budget ? { budget } : {}),
  };
}

/**
 * Where Card stands, after it is picked: the question about the agent cards
 * that fit, then the new budget being picked, then made, then its approval.
 */
type CardFlow =
  | { phase: "reuse" }
  | { phase: "budget"; fromReuse: boolean; error?: string }
  | { phase: "creating"; fromReuse: boolean; pick: BudgetPick }
  | {
      phase: "approve";
      requestId: string;
      fromReuse: boolean;
      pick: BudgetPick;
      outcome?: ApprovalOutcome;
    };

/**
 * Choosing how to pay, in the thread, for the desktop and the phone: the
 * agent asks in its bubble, and one card under it shows the product and
 * the three ways. Shop Pay answers at once; Another way offers PayPal,
 * Klarna, or a field.
 *
 * Card is picked for good, with no way back, and what follows comes as the
 * agent's next messages: whether to use an agent card the user already has
 * that fits, when there is one; else a new budget, which the user sets up
 * (what it covers and how much, at least this purchase), then reviews on
 * the same approval card the chat shows for any other. The choice answers
 * once the card is settled: the card to pay with, or that the new one was
 * not approved. The answer names the request and the budget, so a chat
 * opened again draws the same messages.
 */
export function PaymentChoiceInThread({
  input,
  product,
  output,
  onChoose,
  onReview,
  bubbleClassName,
  buttonSize = "xl",
  className,
}: {
  input: PaymentChoiceInput;
  product?: FoundProduct;
  output?: PaymentChoiceOutcome;
  onChoose: (outcome: PaymentChoiceOutcome) => void;
  /**
   * Open the approval of the new card in the frame's own sheet, and call
   * `done` when it ends. Leave it out for a dialog of its own.
   */
  onReview?: (requestId: string, done: (outcome: ApproveOutcome) => void) => void;
  bubbleClassName?: string;
  buttonSize?: "lg" | "xl";
  className?: string;
}) {
  const { api } = useAgentCommerce();
  const subject = choiceSubject(input, product);
  const [step, setStep] = useState<"ways" | "other">("ways");
  const [typed, setTyped] = useState("");
  const [flow, setFlow] = useState<CardFlow>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState<string>();
  // The pick shows at once; the tool output lands once the chat is idle.
  const [picked, setPicked] = useState<PaymentChoiceOutcome>();
  const answer = output ?? picked;
  // The cards the user has, read while the question is open, for Card's question.
  const cards = useAgentCards({ enabled: !answer });
  const cardsReady = !cards.loading || cards.data !== undefined;
  const fitting = fittingCards(cards.data, input.url, subject);
  const noneFit = cardsReady && fitting.length === 0;
  const choose = useCallback(
    (outcome: PaymentChoiceOutcome) => {
      setPicked(outcome);
      onChoose(outcome);
    },
    [onChoose],
  );

  // What the thread shows under the choice, live or from the answer.
  const card = answer?.method === "card" || answer?.method === "agent_card" || Boolean(flow);
  const reused = answer?.method === "agent_card" && !answer.newCard ? answer : undefined;
  const showReuse =
    Boolean(reused) || (flow !== undefined && (flow.phase === "reuse" || flow.fromReuse));
  const approval =
    flow?.phase === "approve"
      ? { requestId: flow.requestId, outcome: flow.outcome }
      : answer?.requestId
        ? {
            requestId: answer.requestId,
            outcome: {
              status:
                answer.approval ?? (answer.newCard ? ("active" as const) : ("failed" as const)),
              ...(answer.agentCardId ? { agentCardId: answer.agentCardId } : {}),
            },
          }
        : undefined;

  // The new budget: being set up, or picked, live or from the answer.
  const newBudget =
    flow && flow.phase !== "reuse"
      ? { pick: flow.phase === "budget" ? undefined : flow.pick }
      : answer?.requestId && (answer.newCard || answer.method === "card")
        ? { pick: { category: answer.name, amount: answer.budget, days: answer.days } }
        : undefined;

  // The approval ended: approved is the card to pay with; not approved, the
  // agent asks how else to pay.
  const approvalDone = (requestId: string, pick: BudgetPick, o: ApproveOutcome) => {
    const outcome = toApprovalOutcome(o);
    setFlow((f) => (f?.phase === "approve" ? { ...f, outcome } : f));
    choose(newBudgetOutcome(o, pick, requestId));
  };

  function review(requestId: string, pick: BudgetPick) {
    if (onReview) onReview(requestId, (o) => approvalDone(requestId, pick, o));
    else setDialogOpen(true);
  }

  // A new budget: the user sets it up first, and it is made on Continue.
  function newCard(fromReuse: boolean) {
    setNote(undefined);
    setFlow({ phase: "budget", fromReuse });
  }

  // Made now, for what the user picked, and its approval opens.
  async function createBudget(pick: BudgetPick, fromReuse: boolean) {
    setFlow({ phase: "creating", fromReuse, pick });
    try {
      const made = await api.createAgentCardRequest(budgetRequest(pick));
      setFlow({ phase: "approve", requestId: made.id, fromReuse, pick });
      // The approval opens at once; Review opens it again.
      review(made.id, pick);
    } catch (err) {
      // Nothing was made: the form comes back, with what went wrong.
      setFlow({ phase: "budget", fromReuse, error: errorMessage(err) });
    }
  }

  function pickWay(option: PaymentOption) {
    // Card asks about the agent cards that fit; with none, it is a new budget
    // at once. Tapped before the cards are in, its question waits for them.
    if (option.method === "card") {
      if (noneFit) newCard(false);
      else setFlow({ phase: "reuse" });
    } else if (option.method === "other" && !option.name) {
      setStep("other");
    } else {
      choose(paymentChoiceOutcome(option, subject.budget));
    }
  }

  function pickCard(option: PaymentOption) {
    if (option.method === "agent_card") choose(paymentChoiceOutcome(option, subject.budget));
    else newCard(true);
  }

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    if (typed.trim()) {
      choose(paymentChoiceOutcome(SOMETHING_ELSE, subject.budget, typed));
    }
  }

  const back = (
    <Button type="button" size="lg" variant="ghost" onClick={() => setStep("ways")}>
      Back
    </Button>
  );
  const box = cn(
    "flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10",
    className,
  );

  return (
    <>
      <AgentBubble text={paymentChoiceQuestion(subject.item)} className={bubbleClassName} />
      <div className={box}>
        <div className="flex items-center gap-3 p-3">
          <ProductImage
            src={subject.image}
            alt={subject.item}
            className="size-12 shrink-0 rounded-xl ring-1 ring-foreground/10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{subject.item}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                subject.price ? formatAmount(subject.price.amount, subject.price.currency) : null,
                subject.store,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {card ? (
          <ChosenRow mark={{ icon: CreditCard }} label="Card" />
        ) : answer ? (
          <ChosenRow mark={markOf(answer)} label={paymentChoiceLabel(answer)} />
        ) : step === "other" ? (
          <Step
            question={OTHER_STEP_QUESTION}
            footer={
              <form onSubmit={submitTyped} className="flex flex-col gap-2 p-3">
                <label htmlFor="payment-other" className="text-xs text-muted-foreground">
                  Something else
                </label>
                <Input
                  id="payment-other"
                  // 16px at every width, or iOS zooms in when it takes focus.
                  className="h-11 text-base md:text-base"
                  autoComplete="off"
                  placeholder="A gift card, Afterpay…"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <div className="flex gap-2">
                  {back}
                  <Button type="submit" size="lg" className="flex-1" disabled={!typed.trim()}>
                    Continue
                  </Button>
                </div>
              </form>
            }
          >
            <OptionRows options={otherOptions()} onPick={pickWay} />
          </Step>
        ) : (
          <div className="border-t border-border/60">
            {note ? <p className="px-3 pt-3 text-sm text-destructive">{note}</p> : null}
            <OptionRows options={paymentOptions()} onPick={pickWay} />
          </div>
        )}
      </div>

      {/* The agent's next message: the agent cards that fit. */}
      {showReuse ? (
        <>
          <AgentBubble
            text={noneFit && !reused && flow?.phase === "reuse" ? NO_CARD_FITS : CARD_STEP_QUESTION}
            className={bubbleClassName}
          />
          <div className={box}>
            {reused ? (
              <ChosenRow
                mark={{ icon: WalletCards }}
                label={reused.name?.trim() || "My agent card"}
                first
              />
            ) : flow && flow.phase !== "reuse" ? (
              <ChosenRow mark={{ icon: CreditCard }} label="New budget" first />
            ) : cardsReady ? (
              <OptionRows options={cardOptions(subject.budget, fitting)} onPick={pickCard} />
            ) : (
              <div className="flex flex-col gap-3 p-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-xl" />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* The agent's next message: the new budget, to set up. */}
      {newBudget ? (
        <>
          <AgentBubble text={budgetQuestion()} className={bubbleClassName} />
          <div className={box}>
            {newBudget.pick ? (
              <BudgetChosen pick={newBudget.pick} />
            ) : (
              <BudgetPicker
                category={input.category}
                currency={subject.price?.currency ?? "USD"}
                floor={subject.budget}
                error={flow?.phase === "budget" ? flow.error : undefined}
                onSubmit={(pick) => void createBudget(pick, flow?.phase === "budget" && flow.fromReuse)}
                buttonSize={buttonSize}
              />
            )}
          </div>
        </>
      ) : null}

      {/* The agent's next message after that: the new budget, to review. */}
      {flow?.phase === "creating" ? (
        <>
          <AgentBubble text={approvalQuestion(false)} className={bubbleClassName} />
          <div className={cn(box, "gap-3 p-4")}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        </>
      ) : approval ? (
        <ApprovalInThread
          requestId={approval.requestId}
          output={approval.outcome}
          paying={false}
          onReview={() => {
            if (flow?.phase === "approve") review(flow.requestId, flow.pick);
          }}
          bubbleClassName={bubbleClassName}
          buttonSize={buttonSize}
          className={className}
        />
      ) : null}

      {onReview || flow?.phase !== "approve" ? null : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogTitle className="sr-only">Approve</DialogTitle>
            {dialogOpen ? (
              <ApproveAgentCard
                requestId={flow.requestId}
                variant="plain"
                platformName={PLATFORM_NAME}
                onDone={(o) => {
                  approvalDone(flow.requestId, flow.pick, o);
                  // The ending shows for a moment before the dialog goes.
                  setTimeout(() => setDialogOpen(false), APPROVAL_DONE_LINGER_MS);
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** The way picked, in place of the choices: its mark, its name, and Chosen. */
function ChosenRow({ mark, label, first = false }: { mark: Mark; label: string; first?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 p-3", !first && "border-t border-border/60")}>
      <OptionMark mark={mark} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <Badge variant="success">Chosen</Badge>
    </div>
  );
}

/** One more question under the product: its line, its rows, and what goes under them. */
function Step({
  question,
  children,
  footer,
}: {
  question: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-col border-t border-border/60">
      <p className="px-3 pt-3 text-sm font-medium text-foreground">{question}</p>
      {children}
      {footer}
    </div>
  );
}

/** Ways to pay as rows, each a button. */
function OptionRows({
  options,
  onPick,
}: {
  options: PaymentOption[];
  onPick: (option: PaymentOption) => void;
}) {
  return (
    <ul className="flex flex-col">
      {options.map((o) => (
        <li key={optionKey(o)} className="border-b border-border/60 last:border-b-0">
          <button
            type="button"
            onClick={() => onPick(o)}
            className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60"
          >
            <OptionMark mark={o} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.detail}</span>
            </span>
            {o.hints?.length ? (
              <span aria-hidden className="flex shrink-0 items-center gap-1">
                {o.hints.map((src) => (
                  // A plain img: a small static mark, not worth the image optimiser.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" width={30} height={19} className="w-[30px]" />
                ))}
              </span>
            ) : null}
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A way to pay: its own logo when it has one, else a round mark. */
function OptionMark({ mark }: { mark: Mark }) {
  if (mark.logo) {
    return (
      // A plain img: a small static mark, not worth the image optimiser.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={mark.logo} alt="" aria-hidden width={36} height={23} className="w-9 shrink-0" />
    );
  }
  const Icon = mark.icon ?? Wallet;
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
    >
      <Icon className="size-4" />
    </span>
  );
}
