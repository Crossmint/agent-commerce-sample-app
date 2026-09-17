import * as React from "react";
import { cn } from "../lib/utils.js";
import { useGoatOptional } from "../provider.js";

export interface MascotProps extends Omit<React.ComponentProps<"img">, "src"> {
  /** Defaults to the provider's `mascotSrc`, then "/brand/agents/crossmint-agents-mark.svg". */
  src?: string;
  size?: number;
}

/** The Crossmint Agents mark. Used in empty states, success states, and small in navs. */
export function Mascot({ src, size = 96, className, alt = "Crossmint Agents", ...props }: MascotProps) {
  const ctx = useGoatOptional();
  const resolved = src ?? ctx?.mascotSrc ?? "/brand/agents/crossmint-agents-mark.svg";
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
  mascotSrc?: string;
  mascotSize?: number;
}

export function EmptyState({
  title,
  description,
  action,
  mascotSrc,
  mascotSize = 72,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "goat-backdrop flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <Mascot src={mascotSrc} size={mascotSize} />
      <div className="space-y-1">
        <p className="text-lg font-semibold tracking-tight">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
