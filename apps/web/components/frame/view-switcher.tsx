"use client";

import { cn } from "@/lib/cn";
import { VIEW_META, VIEWS, type View } from "./views";

export { VIEW_META, VIEWS, isView, type View } from "./views";

/**
 * The experience switcher: one pill of tabs in the phone tab bar's style,
 * frosted with a soft shadow. Fixed top center on a desktop; the caller
 * places it. Labels hide under `sm` so five tabs fit a phone.
 */
export function ViewSwitcher({ value, onChange, className }: { value: View; onChange: (view: View) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Experience" className={cn("flex items-center gap-1 rounded-full bg-card/70 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-lg", className)}>
      {VIEWS.map((view) => {
        const { label, icon: Icon } = VIEW_META[view];
        const active = view === value;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(view)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium tracking-tight whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-4",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn(!active && "hidden sm:inline")}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
