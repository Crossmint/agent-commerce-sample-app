import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils.js";

/**
 * A styled native select. It works everywhere, needs no portal, and reads
 * well on phones. Pass `<option>` children.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div data-slot="select" className="relative">
      <select
        className={cn(
          "flex h-11 w-full appearance-none rounded-xl border border-input bg-background px-4 pr-10 text-base text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { Select };
