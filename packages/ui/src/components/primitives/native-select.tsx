import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils.js";

/**
 * A styled native select in the same pill as Input. It works everywhere,
 * needs no portal, and reads well on phones. For a list that carries more
 * than a line of text per row, reach for `Select`, the Radix one, instead.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div data-slot="native-select" className="relative">
      <select
        className={cn(
          "flex h-9 w-full appearance-none rounded-4xl border border-input bg-input/30 px-3 pr-9 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
