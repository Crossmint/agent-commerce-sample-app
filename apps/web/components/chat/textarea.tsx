import * as React from "react";
import { cn } from "@agent-commerce/ui";

/** shadcn-style textarea. Lives here because `@agent-commerce/ui` does not ship one yet. */
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full min-w-0 resize-none rounded-xl border-0 bg-muted px-4 py-3 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
