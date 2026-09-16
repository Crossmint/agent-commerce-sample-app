import type { ReactNode } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Copy, Lock, RotateCw, Share } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MobileBrowserProps {
  /** Host shown in the address bar, e.g. "yourplatform.com". */
  domain: string;
  /** Path shown after the host. Default "/approve/…". */
  path?: string;
  /** Toolbar color. Match it to the page inside. */
  tone?: "light" | "dark";
  children: ReactNode;
  className?: string;
}

/**
 * Safari-style mobile chrome: address bar with a lock at the top, the page in
 * the middle, the tab bar at the bottom. Meant to sit inside `PhoneFrame`.
 */
export function MobileBrowser({ domain, path = "/approve/…", tone = "dark", children, className }: MobileBrowserProps) {
  const dark = tone === "dark";
  const bar = dark ? "bg-[#1c1c1e] text-white" : "bg-[#f2f2f7] text-black";
  const line = dark ? "border-white/10" : "border-black/10";
  return (
    <div className={cn("flex h-full flex-col font-sans", className)}>
      <div className={cn("flex items-center gap-2.5 border-b px-3 pt-11 pb-2", bar, line)}>
        <span className="text-[11px] font-semibold opacity-70">AA</span>
        <span
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] font-medium",
            dark ? "bg-white/10" : "bg-black/5",
          )}
        >
          <Lock className="size-3 shrink-0 opacity-70" strokeWidth={2.5} />
          <span className="truncate">
            {domain}
            <span className="opacity-55">{path}</span>
          </span>
        </span>
        <RotateCw className="size-3.5 opacity-70" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div className={cn("flex items-center justify-between border-t px-6 pt-2.5 pb-6 text-[#0a84ff] [&_svg]:size-[18px]", bar, line)}>
        <ChevronLeft />
        <ChevronRight className="opacity-40" />
        <Share />
        <BookOpen />
        <Copy />
      </div>
    </div>
  );
}
