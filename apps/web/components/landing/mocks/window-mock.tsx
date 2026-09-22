import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A small desktop window: a title bar with the three traffic lights and an
 * optional address pill, then the content. A card in the theme's terms, sized
 * by its parent. `tone="dark"` is the terminal, the one dark surface on the
 * page; the lights keep their colors on it, as they do on a real title bar.
 *
 * The colors are the literals `DesktopFrame` uses, so the mocked windows and
 * the real one on /app wear the same chrome.
 */
export function WindowMock({
  address,
  tone = "light",
  className,
  children,
}: {
  address?: string;
  tone?: "light" | "dark";
  className?: string;
  children: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl ring-1 ring-foreground/10",
        dark ? "bg-foreground text-background" : "bg-card text-card-foreground",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-9 shrink-0 items-center gap-3 px-3.5",
          dark ? "border-b border-background/10" : "border-b border-border bg-device-frame",
        )}
      >
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        {address ? (
          <div
            className={cn(
              "mx-auto flex h-6 w-full max-w-[60%] items-center justify-center truncate rounded-md px-3 text-[11px]",
              dark
                ? "bg-background/10 text-background/70"
                : "bg-background text-muted-foreground ring-1 ring-foreground/5",
            )}
          >
            {address}
          </div>
        ) : null}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
