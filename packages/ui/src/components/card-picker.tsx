"use client";

import * as React from "react";
import type { PaymentMethod } from "@goat-wallet/core";
import { CreditCard, Plus } from "lucide-react";
import { paymentMethodLabel } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { Select } from "./primitives/select.js";
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
  /** Extra props for the inline SaveCard. */
  saveCardProps?: Omit<SaveCardProps, "onSaved" | "className">;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * A select of saved cards, brand plus last four. "Add a new card" sits at the
 * bottom of the list and reveals SaveCard in place.
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
  const noCards = !loading && cards.length === 0;

  // With no saved cards, go straight to the save form.
  React.useEffect(() => {
    if (noCards && allowAdd) setAdding(true);
  }, [noCards, allowAdd]);

  if (loading && !paymentMethods) {
    return <Skeleton className={cn("h-11 w-full", className)} />;
  }

  const selectValue = adding ? ADD_NEW_CARD : (value ?? "");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <CreditCard aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Select
          id={id}
          className="pl-10"
          value={selectValue}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v === ADD_NEW_CARD) {
              setAdding(true);
              return;
            }
            setAdding(false);
            onChange(v);
          }}
        >
          {!value && !adding ? (
            <option value="" disabled>
              {cards.length ? "Choose a card" : "No saved cards"}
            </option>
          ) : null}
          {cards.map((pm) => (
            <option key={pm.paymentMethodId} value={pm.paymentMethodId}>
              {paymentMethodLabel(pm)}
              {pm.default ? " (default)" : ""}
            </option>
          ))}
          {allowAdd ? <option value={ADD_NEW_CARD}>＋ Add a new card</option> : null}
        </Select>
      </div>

      {adding && allowAdd ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Plus className="size-4" /> New card
          </p>
          <SaveCard
            {...saveCardProps}
            showResult={false}
            onSaved={(result) => {
              setAdding(false);
              onAdded?.(result);
              onChange(result.paymentMethod.paymentMethodId);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
