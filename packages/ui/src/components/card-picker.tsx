"use client";

import * as React from "react";
import type { PaymentMethod } from "@agent-commerce/core";
import { CreditCard, Plus } from "lucide-react";
import { paymentMethodLabel } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { AddCardDialog } from "./add-card-dialog.js";
import { CardMark } from "./card-mark.js";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./primitives/select.js";
import { Skeleton } from "./primitives/skeleton.js";
import { SaveCard, type SaveCardProps, type SaveCardResult } from "./save-card.js";

export const ADD_NEW_CARD = "__add_new_card__";

export interface CardPickerProps {
  paymentMethods: PaymentMethod[] | undefined;
  loading?: boolean;
  /** Selected payment method id. */
  value: string | undefined;
  onChange: (paymentMethodId: string) => void;
  /** Fires when a new card is saved through the picker. The new card is selected. */
  onAdded?: (result: SaveCardResult) => void;
  /** Show "Add a new card". Default true. */
  allowAdd?: boolean;
  /** Extra props for the SaveCard form. */
  saveCardProps?: Omit<SaveCardProps, "onSaved" | "className">;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Pick a saved card, or add one.
 *
 * With cards saved this is only a dropdown: brand and last four per row, the
 * default marked, and "Add a new card" under a rule at the foot. That row
 * opens the card form on its own surface, a bottom sheet on a phone and a
 * modal on a wider screen, so the approval screen stays a single decision.
 *
 * With nothing saved there is nothing to pick from, so the form takes the
 * dropdown's place and the screen asks for a card directly. That is the one
 * case where it shows up unasked.
 */
export function CardPicker({
  paymentMethods,
  loading = false,
  value,
  onChange,
  onAdded,
  allowAdd = true,
  saveCardProps,
  disabled,
  id,
  className,
}: CardPickerProps) {
  const [adding, setAdding] = React.useState(false);
  const cards = React.useMemo(() => (paymentMethods ?? []).filter((pm) => pm.type === "card" || pm.card), [paymentMethods]);

  function saved(result: SaveCardResult) {
    onAdded?.(result);
    onChange(result.paymentMethod.paymentMethodId);
  }

  // The list is still on its way: hold the field's place rather than flashing
  // the form at someone who already has cards.
  if (loading && !paymentMethods) {
    return <Skeleton className={cn("h-12 w-full", className)} />;
  }

  if (cards.length === 0 && allowAdd) {
    return <SaveCard {...saveCardProps} showResult={false} onSaved={saved} className={className} />;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Select
        // "" rather than undefined: the field is controlled from the first
        // render, before the default card is picked, and Radix reads the
        // empty string as "nothing chosen yet" and shows the placeholder.
        value={value ?? ""}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== ADD_NEW_CARD) {
            onChange(next);
            return;
          }
          // Let the dropdown finish closing and hand focus back before the
          // dialog takes it, or the two fight over it and the trap loses.
          setTimeout(() => setAdding(true), 0);
        }}
      >
        {/* The phone-screen field: tall, 12px corners, on the grey fill, no border. */}
        <SelectTrigger id={id} className="h-12 rounded-xl border-0 bg-muted px-4 data-[size=default]:h-12">
          {value ? null : <CreditCard aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
          <SelectValue placeholder={cards.length ? "Choose a card" : "No saved cards"} />
        </SelectTrigger>
        <SelectContent>
          {cards.map((pm) => (
            <SelectItem key={pm.paymentMethodId} value={pm.paymentMethodId}>
              <CardMark paymentMethod={pm} />
              <span className="min-w-0 flex-1 truncate">{paymentMethodLabel(pm)}</span>
              {pm.default ? <span className="shrink-0 text-xs text-muted-foreground">Default</span> : null}
            </SelectItem>
          ))}
          {allowAdd ? (
            <>
              {cards.length ? <SelectSeparator /> : null}
              <SelectItem value={ADD_NEW_CARD} className="font-medium text-primary">
                <Plus aria-hidden className="size-4 shrink-0" />
                Add a new card
              </SelectItem>
            </>
          ) : null}
        </SelectContent>
      </Select>

      {allowAdd ? <AddCardDialog open={adding} onOpenChange={setAdding} onSaved={saved} saveCardProps={saveCardProps} /> : null}
    </div>
  );
}
