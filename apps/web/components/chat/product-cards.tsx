"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag, Star } from "lucide-react";
import { Button, Dialog, DialogContent, DialogTitle, cn } from "@agent-commerce/ui";
import type { FoundProduct } from "@/lib/chat/shopify-catalog";

/**
 * Products the agent found or is about to suggest, as cards with their
 * pictures, in a carousel. It rests on a card's edge, never between two;
 * a fade on either side says there is more that way, and on a device with a
 * pointer, arrows page through it.
 *
 * A tap on a card only opens its details: nothing is bought by accident. The
 * card's Buy button, and the one in the details, picks it: it sends a plain
 * message naming it, and the agent buys it at its url.
 */
export function ProductCards({
  products,
  onPick,
  onOpen,
  compact = false,
  className,
}: {
  products: FoundProduct[];
  /** Buy: sends the pick. Leave it out once the pick no longer matters, and the cards are only a record. */
  onPick?: (message: string) => void;
  /**
   * Show a product's details. Leave it out for a dialog of its own; a phone
   * frame passes a sheet that stays inside the phone.
   */
  onOpen?: (product: FoundProduct) => void;
  /** The phone's narrower cards. */
  compact?: boolean;
  className?: string;
}) {
  const row = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [shown, setShown] = useState<FoundProduct | null>(null);
  const open = onOpen ?? setShown;

  // Which way there is more to see, as the row scrolls or resizes.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    el.scrollLeft = 0;
    const measure = () =>
      setEdges({
        left: el.scrollLeft > 2,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [products.length]);

  if (!products.length) return null;
  const page = (direction: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const card = el.querySelector("li")?.getBoundingClientRect().width ?? 180;
    el.scrollBy({ left: direction * (card + GAP), behavior: "smooth" });
  };

  return (
    <div
      className={cn("group/cards relative w-full", compact ? "max-w-none" : "max-w-2xl", className)}
    >
      <ul
        ref={row}
        aria-label="Products"
        // A pixel of padding keeps the cards' outlines from being clipped by the scroll box.
        className="flex w-full snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain p-px pb-1 scrollbar-none"
      >
        {products.map((p) => (
          <li
            key={p.url}
            className={cn("shrink-0 snap-start", compact ? "w-[150px]" : "w-[180px]")}
          >
            <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
              <button
                type="button"
                aria-label={`Details: ${p.title}`}
                onClick={() => open(p)}
                className="flex flex-1 flex-col text-left transition-colors hover:bg-muted/60"
              >
                <ProductImage src={p.image} alt={p.title} />
                <span className="flex flex-col gap-0.5 px-3 pt-3 pb-2">
                  <span className="line-clamp-2 text-[13px] leading-snug font-medium text-foreground">
                    {p.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[p.price, p.store].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
              {onPick ? (
                <div className="px-3 pb-3">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={() => onPick(pickMessage(p))}
                  >
                    Buy
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* More this way: the edge fades into the thread's own ground. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity",
          edges.left ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity",
          edges.right ? "opacity-100" : "opacity-0",
        )}
      />
      <PageButton side="left" show={edges.left} onClick={() => page(-1)} />
      <PageButton side="right" show={edges.right} onClick={() => page(1)} />

      {onOpen ? null : (
        <Dialog open={shown !== null} onOpenChange={(o) => !o && setShown(null)}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
            <DialogTitle className="sr-only">{shown?.title ?? "Product"}</DialogTitle>
            {shown ? (
              <ProductDetails
                product={shown}
                onBuy={
                  onPick
                    ? () => {
                        onPick(pickMessage(shown));
                        setShown(null);
                      }
                    : undefined
                }
              />
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * One product in full, for a dialog or a sheet: the picture, name, price and
 * store, the rating, the options it comes in, what the store says about it,
 * and Buy.
 */
export function ProductDetails({
  product,
  onBuy,
  className,
}: {
  product: FoundProduct;
  /** Leave it out once the pick no longer matters. */
  onBuy?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ProductImage
        src={product.image}
        alt={product.title}
        className="aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-foreground/10"
      />
      <div className="flex flex-col gap-1">
        <h3 className="text-lg leading-snug font-medium text-foreground">{product.title}</h3>
        <p className="text-sm text-muted-foreground">
          {[product.price, product.store].filter(Boolean).join(" · ")}
        </p>
        {product.rating ? (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star aria-hidden className="size-3.5 fill-current text-warning" />
            {product.rating}
          </p>
        ) : null}
      </div>
      {product.options?.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {product.options.map((o) => (
            <li key={o} className="text-foreground">
              {o}
            </li>
          ))}
        </ul>
      ) : null}
      {product.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
      ) : null}
      {onBuy ? (
        <Button type="button" size="xl" className="w-full" onClick={onBuy}>
          Buy
        </Button>
      ) : null}
    </div>
  );
}

/** The space between cards, to page by one card at a time. */
const GAP = 10;

/** An arrow over the carousel's edge, for a pointer; touch swipes instead. */
function PageButton({
  side,
  show,
  onClick,
}: {
  side: "left" | "right";
  show: boolean;
  onClick: () => void;
}) {
  if (!show) return null;
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous products" : "More products"}
      onClick={onClick}
      className={cn(
        "absolute top-[35%] hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-opacity group-hover/cards:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:flex",
        side === "left" ? "left-1.5" : "right-1.5",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** The product's picture, square, on a light ground; a bag when there is none or it fails. */
export function ProductImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn("flex aspect-square w-full items-center justify-center bg-muted", className)}
    >
      {src && !failed ? (
        // A plain img: a store's CDN picture, not worth the image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <ShoppingBag className="size-6 text-muted-foreground" />
      )}
    </span>
  );
}

/** What a tap on a product sends: its name, cut short, and the store. */
export function pickMessage(p: FoundProduct): string {
  return `I'll take the ${shortTitle(p.title)} from ${p.store}`;
}

/** Shopify titles run long ("IQBAR Clean Plant Protein Bars - Chocolate Mint Chip - 12 Count - Keto, …"). */
function shortTitle(title: string): string {
  const parts = title.split(" - ").slice(0, 2).join(" - ");
  return parts.length <= 60 ? parts : `${parts.slice(0, 57).replace(/\s+\S*$/, "")}…`;
}
