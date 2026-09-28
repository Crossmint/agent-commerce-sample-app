import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Spinner } from "@agent-commerce/ui";
import { cn } from "@/lib/cn";

/**
 * "Looking at your saved cards", with a spinner while it runs and a check
 * when it is done: a tool call the user needs to know happened, not to read.
 * The phone and the desktop draw tool calls with it alike.
 */
export function ActivityLine({
  busy,
  failed,
  children,
  className,
}: {
  busy?: boolean;
  failed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        failed && "text-destructive",
        className,
      )}
    >
      {busy ? (
        <Spinner className="size-3" />
      ) : failed ? (
        <CircleAlert className="size-3.5" />
      ) : (
        <CircleCheck className="size-3.5 text-success" />
      )}
      <span className="truncate">{children}</span>
    </div>
  );
}
