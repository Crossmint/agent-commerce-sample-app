import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils.js";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
