"use client";

import type { ComponentType } from "react";
import { ArrowUpRight, CreditCard, ShoppingBag, Ticket, UtensilsCrossed } from "lucide-react";
import { cn } from "@agent-commerce/ui";

/**
 * The ways a new chat offers to start, so a first-time user sees what the
 * agent can do: make an agent card and see the approval, buy a product, book
 * a table, or get event tickets. Each one
 * sends a plain message; from there the user talks to the agent, which asks
 * for what it still needs. The prompt knows these three (see `prompt.ts`).
 */
export interface Starter {
  id: string;
  title: string;
  sub: string;
  /** What the pick sends, as if the user had typed it. */
  message: string;
  icon: ComponentType<{ className?: string }>;
}

export const STARTERS: Starter[] = [
  {
    id: "card",
    title: "Create an agent card",
    sub: "A small budget you approve, to see how an agent spends",
    message: "Create an agent card with a $20 budget for lunch this week",
    icon: CreditCard,
  },
  {
    id: "something",
    title: "Buy me something",
    sub: "Anything from an online store, or IQBAR bars if you cannot decide",
    message: "Buy me something",
    icon: ShoppingBag,
  },
  {
    id: "table",
    title: "Book a table",
    sub: "At a restaurant you pick, or one the agent finds",
    message: "Book me a table for a restaurant",
    icon: UtensilsCrossed,
  },
  {
    id: "experience",
    title: "Book event tickets",
    sub: "Concerts, shows and experiences in your city",
    message: "Find an event in my city and book me tickets",
    icon: Ticket,
  },
];

/**
 * The starters as cards. `grid` puts them side by side where there is room
 * (the desktop chat); `list` stacks them (the phone).
 */
export function StarterCards({
  onPick,
  layout = "list",
  className,
}: {
  onPick: (message: string) => void;
  layout?: "grid" | "list";
  className?: string;
}) {
  return (
    <ul
      aria-label="Ways to start"
      className={cn(
        "grid w-full gap-2",
        layout === "grid" ? "sm:grid-cols-2 sm:gap-3" : "grid-cols-1",
        className,
      )}
    >
      {STARTERS.map(({ id, title, sub, message, icon: Icon }) => (
        <li key={id} className="flex">
          <button
            type="button"
            onClick={() => onPick(message)}
            className={cn(
              "group flex w-full gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted",
              layout === "grid" ? "items-start sm:flex-col" : "items-center",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{title}</span>
              <span className="text-xs leading-snug text-muted-foreground">{sub}</span>
            </span>
            {layout === "list" ? (
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
