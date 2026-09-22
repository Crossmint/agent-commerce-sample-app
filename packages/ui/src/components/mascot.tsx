import * as React from "react";
import { cn } from "../lib/utils.js";
import { useAgentCommerceOptional } from "../provider.js";

export interface MascotProps extends Omit<React.ComponentProps<"img">, "src"> {
  /** Defaults to the provider's `mascotSrc`, then "/crossmint-mark.svg". */
  src?: string;
  size?: number;
}

/** The Crossmint mark. Used in empty states, success states, and small in navs. */
export function Mascot({ src, size = 96, className, alt = "Crossmint", ...props }: MascotProps) {
  const ctx = useAgentCommerceOptional();
  const resolved = src ?? ctx?.mascotSrc ?? "/crossmint-mark.svg";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      width={size}
      height={size}
      alt={alt}
      className={cn("select-none object-contain", className)}
      draggable={false}
      {...props}
    />
  );
}

export interface EmptyStateProps extends React.ComponentProps<"div"> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Nothing here yet, said in words. No mark: the Crossmint logo belongs in the
 * page chrome, and repeating it inside every empty table said nothing about
 * the table.
 */
export function EmptyState({ title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl bg-muted/50 px-6 py-8 text-center",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
