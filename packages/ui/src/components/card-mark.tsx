"use client";

import * as React from "react";
import type { PaymentMethod } from "@agent-commerce/core";
import { CreditCard } from "lucide-react";
import { cardBrandLabel } from "../lib/format.js";
import { cn } from "../lib/utils.js";

/** Card network short codes. Anything unknown falls back to the brand's first letters. */
const BRAND_CODE: Record<string, string> = {
  visa: "VISA",
  mastercard: "MC",
  master: "MC",
  amex: "AMEX",
  "american-express": "AMEX",
  american_express: "AMEX",
  discover: "DISC",
  diners: "DINE",
  jcb: "JCB",
  unionpay: "UP",
  maestro: "MAES",
};

export type CardMarkSize = "sm" | "md";

/** Both boxes keep a card's proportions; the code inside scales with them. */
const SIZE: Record<CardMarkSize, { box: string; code: string; icon: string }> = {
  sm: { box: "h-6 w-9 rounded-[3px]", code: "text-[8px]", icon: "size-3.5" },
  md: { box: "h-10 w-16 rounded-sm", code: "text-[11px]", icon: "size-5" },
};

export interface CardMarkProps {
  paymentMethod: PaymentMethod;
  /** "sm" for a row in a field list, "md" for the saved-cards list. Default "sm". */
  size?: CardMarkSize;
  className?: string;
}

/**
 * The card's own artwork, which Crossmint sends on `display.imageUrl`. Each
 * file is a white rounded card with the network on it, and the files do not
 * share an aspect ratio — Visa's is square, Mastercard's is a card shape — so
 * the artwork covers the box and the box crops it, rather than being fitted
 * inside with white bars beside it. Both marks sit well clear of the edges,
 * so nothing that matters is cropped. Without artwork, the network's short
 * code stands in; without that, a card icon.
 */
export function CardMark({ paymentMethod, size = "sm", className }: CardMarkProps) {
  const brand = paymentMethod.card?.brand;
  const src = paymentMethod.display?.imageUrl;
  const code = brand ? (BRAND_CODE[brand.toLowerCase()] ?? cardBrandLabel(brand).slice(0, 4).toUpperCase()) : undefined;
  const s = SIZE[size];
  const box = cn("shrink-0 border border-border", s.box, className);
  if (src) {
    // A plain img: this package has no framework image component, and the
    // file is a small SVG on Crossmint's CDN.
    // eslint-disable-next-line @next/next/no-img-element
    return <img aria-hidden alt="" src={src} loading="lazy" className={cn(box, "bg-white object-cover")} />;
  }
  return (
    <span
      aria-hidden
      className={cn(box, "inline-flex items-center justify-center bg-background leading-none font-black tracking-tight text-foreground", s.code)}
    >
      {code ?? <CreditCard className={cn(s.icon, "text-muted-foreground")} />}
    </span>
  );
}
