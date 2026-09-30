"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ChevronRight, Plus, Wallet, WalletCards, type LucideIcon } from "lucide-react";
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
  type CreateAgentCardRequestInput,
} from "@agent-commerce/ui";
import { PLATFORM_NAME } from "@/components/brand";
import {
  BUDGET_DAY_OPTIONS,
  DEFAULT_BUDGET_CATEGORY,
  DEFAULT_BUDGET_DAYS,
  budgetAmounts,
  budgetNote,
  budgetQuestion,
  daysLabel,
  defaultBudgetAmount,
  parseBudgetAmount,
} from "@/lib/chat/budget";
import type { Money } from "@/lib/chat/payment-choice";
import { CHAT_REQUESTER } from "@/lib/chat/requester";
import type { ApprovalOutcome, BudgetOutcome } from "@/lib/chat/tools";
import { APPROVAL_DONE_LINGER_MS, ApprovalInThread, approvalQuestion } from "./agent-card-approval";
import { toApprovalOutcome } from "./parts";
import { AgentBubble } from "./text";

/** What the user settled on: what the budget covers, how much, and for how long. */
export interface BudgetPick {
  category: string;
  amount: Money;
  /** Missing on a budget picked before this was a choice: the default. */
  days?: number;
}

/** The request for the agent card a budget is: no store lock, for the days picked. */
export function budgetRequest(pick: BudgetPick): CreateAgentCardRequestInput {
  return {
    amount: pick.amount,
    description: pick.category,
    expiresInHours: (pick.days ?? DEFAULT_BUDGET_DAYS) * 24,
    requester: CHAT_REQUESTER,
  };
}

/** The budget in a few words: "Clothing, $50.00, 7 days". */
export function budgetLabel(pick: { category?: string; amount?: Money; days?: number }): string {
  const amount = pick.amount ? formatAmount(pick.amount.value, pick.amount.currency) : undefined;
  return [pick.category?.trim() || "Budget", amount, pick.days ? daysLabel(pick.days) : undefined]
    .filter(Boolean)
    .join(", ");
}

/**
 * The budget form: what it covers, which the agent suggests and the user can
 * change, how long it lasts, and $20, $50, $100 or an amount they type, with
 * one picked from the start. Continue answers. With a floor (the purchase at
 * hand, with room for shipping and tax), amounts below it are not offered.
 */
export function BudgetPicker({
  category: suggestedCategory,
  currency,
  floor,
  suggested,
  busy = false,
  error,
  onSubmit,
  onCancel,
  cancelLabel = "Not now",
  buttonSize = "xl",
}: {
  category?: string;
  currency: string;
  floor?: Money;
  suggested?: Money;
  busy?: boolean;
  error?: string;
  onSubmit: (pick: BudgetPick) => void;
  /** Not now. Left out where the budget is a step the user already chose. */
  onCancel?: () => void;
  /** What the button under Continue says. */
  cancelLabel?: string;
  buttonSize?: "lg" | "xl";
}) {
  const options = budgetAmounts(currency, floor);
  const offered = (m: Money) => options.some((o) => Number(o.value) === Number(m.value));
  const [category, setCategory] = useState(suggestedCategory?.trim() || DEFAULT_BUDGET_CATEGORY);
  // One amount is picked from the start. An amount the agent suggested that
  // is not offered opens Other with it.
  const [picked, setPicked] = useState<Money | "other">(() =>
    suggested && !offered(suggested)
      ? "other"
      : (defaultBudgetAmount(options, suggested, Boolean(floor)) ?? "other"),
  );
  const [typed, setTyped] = useState(suggested && !offered(suggested) ? suggested.value : "");
  const [days, setDays] = useState<number>(DEFAULT_BUDGET_DAYS);
  const [problem, setProblem] = useState<string>();

  // Continue is the answer: the budget is made and its approval opens.
  function submit(e: FormEvent) {
    e.preventDefault();
    const covers = category.trim();
    if (!covers) {
      setProblem("Say what the budget is for, such as Groceries.");
      return;
    }
    if (picked !== "other") {
      onSubmit({ category: covers, amount: picked, days });
      return;
    }
    const parsed = parseBudgetAmount(typed, currency, floor);
    if ("problem" in parsed) {
      setProblem(parsed.problem);
      return;
    }
    onSubmit({ category: covers, amount: parsed.amount, days });
  }

  const chip = (selected: boolean) =>
    cn(
      "h-10 flex-1 rounded-xl px-3 text-sm font-medium ring-1 transition-colors disabled:opacity-60",
      selected
        ? "bg-primary/10 text-foreground ring-primary"
        : "bg-card text-foreground ring-foreground/15 hover:bg-muted",
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="budget-category" className="text-xs text-muted-foreground">
          For
        </label>
        <Input
          id="budget-category"
          // 16px at every width, or iOS zooms in when it takes focus.
          className="h-11 text-base md:text-base"
          autoComplete="off"
          maxLength={60}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setProblem(undefined);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span id="budget-days" className="text-xs text-muted-foreground">
          Lasts
        </span>
        <div role="radiogroup" aria-labelledby="budget-days" className="flex gap-2">
          {BUDGET_DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              className={chip(days === d)}
              disabled={busy}
              onClick={() => setDays(d)}
            >
              {daysLabel(d)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id="budget-amount" className="text-xs text-muted-foreground">
          Up to
        </span>
        <div role="radiogroup" aria-labelledby="budget-amount" className="flex gap-2">
          {options.map((o) => {
            const selected = picked !== "other" && picked.value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={chip(selected)}
                disabled={busy}
                onClick={() => {
                  setPicked(o);
                  setProblem(undefined);
                }}
              >
                {formatAmount(o.value, o.currency)}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={picked === "other"}
            className={chip(picked === "other")}
            disabled={busy}
            onClick={() => {
              setPicked("other");
              setProblem(undefined);
            }}
          >
            Other
          </button>
        </div>
        {picked === "other" ? (
          <Input
            aria-label={`Amount in ${currency.toUpperCase()}`}
            className="h-11 text-base md:text-base"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder={`Amount in ${currency.toUpperCase()}`}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setProblem(undefined);
            }}
          />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{budgetNote(days)}</p>
      {problem || error ? <p className="text-sm text-destructive">{problem ?? error}</p> : null}
      <div className="flex flex-col gap-1">
        <Button type="submit" size={buttonSize} className="w-full" disabled={busy}>
          Continue
        </Button>
        {onCancel ? (
          <Button
            type="button"
            size={buttonSize}
            variant="ghost"
            className="w-full"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** The budget once picked, in place of the form. */
export function BudgetChosen({
  pick,
  className,
}: {
  pick: { category?: string; amount?: Money; days?: number };
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 p-3", className)}>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
      >
        <WalletCards className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{budgetLabel(pick)}</span>
      <Badge variant="success">Chosen</Badge>
    </div>
  );
}

/**
 * The general budgets the user has, to pay for a purchase from again:
 * active, able to pay at a checkout (a live rail that makes a card), not
 * locked to a store, with money left. The most left first; at most two.
 */
export function generalBudgets(cards: AgentCard[] | undefined): AgentCard[] {
  return (cards ?? [])
    .filter(
      (c) =>
        agentCardGroup(c) === "active" &&
        canPayAtCheckout(c) &&
        !c.merchant &&
        Number.parseFloat(c.amount.available) > 0,
    )
    .sort((a, b) => Number.parseFloat(b.amount.available) - Number.parseFloat(a.amount.available))
    .slice(0, 2);
}

/** A budget the user has, picked again for this purchase. */
export function existingBudgetOutcome(card: AgentCard): BudgetOutcome {
  return {
    status: "active",
    existing: true,
    agentCardId: card.orderIntentId,
    category: card.description,
    amount: { value: card.amount.available, currency: card.amount.currency },
  };
}

/**
 * What the agent asks over the budget. For a purchase it never names a
 * price: the store states the total only at its payment step.
 */
export function budgetAsk(purchase: string | undefined, hasBudgets: boolean): string {
  if (!purchase) return budgetQuestion();
  return hasBudgets
    ? `Which budget should I use for ${purchase}? I can set up a new one, use one you have, or you can pay another way than your card.`
    : `To buy ${purchase}, I'll need permission to use your card. What should the budget cover, and how much?`;
}

/** Where a budget stands: choosing one, being picked, being made, then its approval. */
type BudgetFlow =
  | { phase: "choose" }
  | { phase: "pick"; error?: string }
  | { phase: "creating"; pick: BudgetPick }
  | { phase: "approve"; pick: BudgetPick; requestId: string; outcome?: ApprovalOutcome };

/**
 * A budget, in the thread, for the desktop and the phone: the agent asks in
 * its bubble, the form sits under it, and Continue makes the agent card and
 * opens the same approval the chat shows for any other.
 *
 * Before a purchase (`input.purchase`), it settles how to pay first: the
 * general budgets the user has, a new one, or another way to pay, which the
 * store's payment step offers. With no budget yet, it goes straight to the
 * form, with the other way under it.
 *
 * The tool answers once the approval ends, or at once for a budget they had,
 * another way, or Not now. The answer names the request, so a chat opened
 * again draws the same messages.
 */
export function BudgetInThread({
  input,
  output,
  onOutcome,
  onReview,
  bubbleClassName,
  buttonSize = "xl",
  className,
}: {
  input: { category: string; amount?: Money; purchase?: string };
  output?: BudgetOutcome;
  onOutcome: (outcome: BudgetOutcome) => void;
  /** Open the approval in the frame's own sheet, and call `done` when it ends. Leave it out for a dialog. */
  onReview?: (requestId: string, done: (outcome: ApproveOutcome) => void) => void;
  bubbleClassName?: string;
  buttonSize?: "lg" | "xl";
  className?: string;
}) {
  const { api } = useAgentCommerce();
  const forPurchase = Boolean(input.purchase);
  const [flow, setFlow] = useState<BudgetFlow>({ phase: forPurchase ? "choose" : "pick" });
  const [dialogOpen, setDialogOpen] = useState(false);
  // The budgets the user has, read while a purchase waits on this.
  const cards = useAgentCards({ enabled: forPurchase && !output });
  const cardsReady = !cards.loading || cards.data !== undefined;
  const budgets = generalBudgets(cards.data);
  // The question is settled once, when the budgets are in, and kept: asked
  // before they load it would change under the reader, and again on New budget.
  const [asked, setAsked] = useState<string>();
  const ready = !forPurchase || Boolean(output) || cardsReady;
  const question =
    asked ??
    (ready
      ? budgetAsk(input.purchase, output ? Boolean(output.existing) : budgets.length > 0)
      : undefined);
  // Stored on the render that first has it, React's way to keep a value once.
  if (!asked && question) setAsked(question);
  const box = cn(
    "flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10",
    className,
  );

  async function create(pick: BudgetPick) {
    setFlow({ phase: "creating", pick });
    try {
      const made = await api.createAgentCardRequest(budgetRequest(pick));
      setFlow({ phase: "approve", pick, requestId: made.id });
      // The approval opens at once; Review opens it again.
      review(pick, made.id);
    } catch (err) {
      // Nothing was made: the form comes back, with what went wrong.
      setFlow({ phase: "pick", error: errorMessage(err) });
    }
  }

  function approvalDone(pick: BudgetPick, requestId: string, o: ApproveOutcome) {
    const outcome = toApprovalOutcome(o);
    setFlow((f) => (f.phase === "approve" ? { ...f, outcome } : f));
    onOutcome({
      ...outcome,
      requestId,
      category: pick.category,
      amount: pick.amount,
      ...(pick.days ? { days: pick.days } : {}),
    });
  }

  function review(pick: BudgetPick, requestId: string) {
    if (onReview) onReview(requestId, (o) => approvalDone(pick, requestId, o));
    else setDialogOpen(true);
  }

  // Drawn from the answer once there is one, so a chat opened again shows the same.
  const shown: {
    pick?: { category?: string; amount?: Money; days?: number };
    requestId?: string;
    outcome?: ApprovalOutcome;
  } = output
    ? output.status === "cancelled" || output.status === "other"
      ? {}
      : {
          pick: { category: output.category, amount: output.amount, days: output.days },
          requestId: output.requestId,
          outcome: {
            status: output.status,
            ...(output.agentCardId ? { agentCardId: output.agentCardId } : {}),
          },
        }
    : flow.phase === "pick" || flow.phase === "choose"
      ? {}
      : {
          pick: flow.pick,
          requestId: flow.phase === "approve" ? flow.requestId : undefined,
          outcome: flow.phase === "approve" ? flow.outcome : undefined,
        };

  const otherWay = () => onOutcome({ status: "other" });
  const form = (
    <BudgetPicker
      category={input.category}
      currency={input.amount?.currency ?? "USD"}
      suggested={input.amount}
      error={flow.phase === "pick" ? flow.error : undefined}
      onSubmit={(pick) => void create(pick)}
      onCancel={forPurchase ? otherWay : () => onOutcome({ status: "cancelled" })}
      cancelLabel={forPurchase ? "Use a different payment method" : undefined}
      buttonSize={buttonSize}
    />
  );

  let body: ReactNode;
  if (output?.status === "cancelled") {
    body = <SettledRow label="No budget for now" badge="Skipped" />;
  } else if (output?.status === "other") {
    body = <SettledRow label="A different payment method" badge="Chosen" chosen />;
  } else if (shown.pick) {
    body = <BudgetChosen pick={shown.pick} />;
  } else if (flow.phase === "choose" && !cardsReady) {
    body = (
      <div className="flex flex-col gap-3 p-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-9 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (flow.phase === "choose" && budgets.length) {
    body = (
      <ul className="flex flex-col">
        <ChoiceRow
          icon={Plus}
          label="New budget"
          detail="Set up another budget on a saved card"
          onPick={() => setFlow({ phase: "pick" })}
        />
        {budgets.map((c) => (
          <ChoiceRow
            key={c.orderIntentId}
            icon={WalletCards}
            label={c.description}
            detail={`${formatAmount(c.amount.available, c.amount.currency)} left. No new approval.`}
            onPick={() => onOutcome(existingBudgetOutcome(c))}
          />
        ))}
        <ChoiceRow
          icon={Wallet}
          label="Use a different payment method"
          detail="I check what the store takes at checkout and ask you then"
          onPick={otherWay}
        />
      </ul>
    );
  } else {
    body = form;
  }

  return (
    <>
      {question ? <AgentBubble text={question} className={bubbleClassName} /> : null}
      <div className={box}>{body}</div>

      {flow.phase === "creating" && !output ? (
        <>
          <AgentBubble text={approvalQuestion(false)} className={bubbleClassName} />
          <div className={cn(box, "gap-3 p-4")}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        </>
      ) : shown.requestId ? (
        <ApprovalInThread
          requestId={shown.requestId}
          output={shown.outcome}
          paying={false}
          onReview={() => {
            if (flow.phase === "approve") review(flow.pick, flow.requestId);
          }}
          bubbleClassName={bubbleClassName}
          buttonSize={buttonSize}
          className={className}
        />
      ) : null}

      {onReview || flow.phase !== "approve" ? null : (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogTitle className="sr-only">Approve</DialogTitle>
            {dialogOpen ? (
              <ApproveAgentCard
                requestId={flow.requestId}
                variant="plain"
                platformName={PLATFORM_NAME}
                onDone={(o) => {
                  approvalDone(flow.pick, flow.requestId, o);
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

/** One way to pay, as a row: its mark, its name and a line under it. */
function ChoiceRow({
  icon: Icon,
  label,
  detail,
  onPick,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  onPick: () => void;
}) {
  return (
    <li className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{detail}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

/** How it was settled, when no budget came of it. */
function SettledRow({ label, badge, chosen = false }: { label: string; badge: string; chosen?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className={cn("min-w-0 flex-1 text-sm", chosen ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
      <Badge variant={chosen ? "success" : "muted"}>{badge}</Badge>
    </div>
  );
}
