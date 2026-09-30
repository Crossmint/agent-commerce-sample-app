/**
 * A budget: an agent card for a kind of purchase (Clothing, Groceries), not
 * for one item. The user picks what it covers and how much, once, and the
 * agent pays for similar purchases from it until it runs out or ends. Plain
 * data and arithmetic, so the tool schema on the server and the picker in
 * the chat share one source.
 */
import { formatAmount } from "@agent-commerce/ui";
import type { Money } from "./payment-choice";

/** How long a budget can last, in days, as the picker offers it. */
export const BUDGET_DAY_OPTIONS = [1, 7, 30] as const;

/** How long a budget lasts unless the user picks otherwise. */
export const DEFAULT_BUDGET_DAYS = 7;

/** "1 day", "7 days". */
export function daysLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

/** What a budget covers when the agent suggested nothing. */
export const DEFAULT_BUDGET_CATEGORY = "Everyday shopping";

/** The amounts the picker offers, smallest first, when nothing sets a floor. */
const STEPS = [20, 50, 100, 200, 500, 1000];

/**
 * Three amounts to offer, each at least `floor` when there is one: the
 * purchase at hand, with room for shipping and tax. With a floor above every
 * step, the floor itself, rounded up to a whole amount.
 */
export function budgetAmounts(currency: string, floor?: Money): Money[] {
  const min = floor ? Number.parseFloat(floor.value) : 0;
  const fits = STEPS.filter((v) => v >= min).slice(0, 3);
  const values = fits.length ? fits : [Math.ceil(min)];
  return values.map((v) => ({ value: v.toFixed(2), currency: currency.toUpperCase() }));
}

/**
 * The amount picked first: what the agent suggested when it is offered; with
 * a purchase at hand, the smallest that covers it; else the middle one.
 */
export function defaultBudgetAmount(
  options: Money[],
  suggested?: Money,
  hasFloor = false,
): Money | undefined {
  const same = suggested
    ? options.find((o) => Number.parseFloat(o.value) === Number.parseFloat(suggested.value))
    : undefined;
  if (same) return same;
  return hasFloor ? options[0] : options[Math.min(1, options.length - 1)];
}

/**
 * A typed amount as money, or why it will not do: not a number, zero, or
 * less than the purchase at hand needs.
 */
export function parseBudgetAmount(
  text: string,
  currency: string,
  floor?: Money,
): { amount: Money } | { problem: string } {
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned) || !(value > 0)) {
    return { problem: "Enter an amount, such as 75." };
  }
  if (floor && value < Number.parseFloat(floor.value)) {
    return { problem: `Enter at least ${formatAmount(floor.value, floor.currency)}, so it covers this purchase.` };
  }
  return { amount: { value: value.toFixed(2), currency: currency.toUpperCase() } };
}

/** What the agent asks over the picker. */
export function budgetQuestion(): string {
  return "I'll need permission to use your card. What should the budget cover, and how much?";
}

/** The line under the picker: what the budget allows, and for how long. */
export function budgetNote(days: number): string {
  return `I can use it for similar purchases for ${daysLabel(days)}, and you approve it first.`;
}
