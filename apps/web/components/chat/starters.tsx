"use client";

import type { ComponentType } from "react";
import {
  ArrowUpRight,
  CreditCard,
  Plane,
  ShoppingBag,
  Soup,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@agent-commerce/ui";

/**
 * The ways a new chat offers to start, so a first-time user sees what the
 * agent can do: add a card, buy a product, order food from their own
 * account, book a table, get event tickets, or book flights and hotels. Each one sends a plain
 * message; from there the user talks to the agent, which asks for what it
 * still needs. The prompt knows each of them (see `prompt.ts`).
 */
export interface Starter {
  id: string;
  title: string;
  /** What the pick sends, as if the user had typed it. */
  message: string;
  icon: ComponentType<{ className?: string }>;
}

export const STARTERS: Starter[] = [
  { id: "card", title: "Add a card", message: "Add a card", icon: CreditCard },
  { id: "something", title: "Buy me something", message: "Buy me something", icon: ShoppingBag },
  { id: "food", title: "Order me food", message: "Order me food", icon: Soup },
  {
    id: "table",
    title: "Book a table",
    message: "Book me a table for a restaurant",
    icon: UtensilsCrossed,
  },
  {
    id: "experience",
    title: "Book event tickets",
    message: "Find an event in my city and book me tickets",
    icon: Ticket,
  },
  {
    id: "travel",
    title: "Book flights and hotels",
    message: "Book me a flight and a hotel",
    icon: Plane,
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
      {STARTERS.map(({ id, title, message, icon: Icon }) => (
        <li key={id} className="flex">
          <button
            type="button"
            onClick={() => onPick(message)}
            className={cn(
              "group flex w-full gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted",
              layout === "grid" ? "items-center sm:flex-col sm:items-start" : "items-center",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{title}</span>
            {layout === "list" ? (
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
