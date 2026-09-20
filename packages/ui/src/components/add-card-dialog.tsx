"use client";

import * as React from "react";
import { useIsMobile } from "../hooks/use-media-query.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./primitives/dialog.js";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./primitives/sheet.js";
import { SaveCard, type SaveCardProps, type SaveCardResult } from "./save-card.js";

export interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires once the card is saved and registered. The surface closes itself. */
  onSaved?: (result: SaveCardResult) => void;
  saveCardProps?: Omit<SaveCardProps, "onSaved" | "className">;
  title?: string;
  description?: string;
}

const TITLE = "Add a card";
const DESCRIPTION = "Your card details go straight to Crossmint's vault. This site never sees the number.";

/**
 * The card form on its own surface: a bottom sheet on a phone, a centered
 * modal from `sm` up. Both are the same Radix dialog, so focus, Escape and
 * the scrim behave the same either way.
 *
 * The form mounts only while the surface is open. That keeps Crossmint's
 * iframe off the page until it is asked for, and gives it a fresh mount each
 * time, which is how a second card gets a blank form.
 */
export function AddCardDialog({ open, onOpenChange, onSaved, saveCardProps, title = TITLE, description = DESCRIPTION }: AddCardDialogProps) {
  const isMobile = useIsMobile();

  const form = (
    <SaveCard
      {...saveCardProps}
      showResult={false}
      onSaved={(result) => {
        onOpenChange(false);
        onSaved?.(result);
      }}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
