"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PHONE_COUNTRIES,
  callingCodeOf,
  flagOf,
  formatCallingCode,
  searchPhoneCountries,
} from "@/lib/countries";

/**
 * Marks an open list that handles Escape itself. A sheet around it lets
 * such an Escape through instead of closing: see `BuyerDetailsSheet`.
 */
export const OWN_ESCAPE = "data-own-escape";

/**
 * The phone's country: its flag and calling code, which open a list with a
 * search on top. Type a country's name, its two-letter code or its calling
 * code; accents do not count. A letter typed on the closed button opens the
 * list with it, so typing "spain" straight away lands on Spain. The arrows
 * move, Enter picks, Escape closes, and a press outside closes too.
 */
export function CountryCodePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (country: string) => void;
  /** The button's own box, drawn as the field beside it. */
  className?: string;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  // Opens upward when the screen or sheet has no room for it below.
  const [up, setUp] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchPhoneCountries(query), [query]);
  const code = callingCodeOf(value);
  const name = PHONE_COUNTRIES.find((c) => c.code === value)?.name ?? value;

  // A press anywhere outside closes the list, and leaves the focus there.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // The highlighted country stays in view as the arrows move it. The list
  // scrolls itself, never the sheet or the page around it.
  useEffect(() => {
    const box = list.current;
    const item = box?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!open || !box || !item) return;
    if (item.offsetTop < box.scrollTop) box.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = item.offsetTop + item.offsetHeight - box.clientHeight;
    }
  }, [open, active]);

  function show(typed: string) {
    setQuery(typed);
    // Nothing typed starts at the country picked; a search, at its best match.
    setActive(
      typed
        ? 0
        : Math.max(
            0,
            PHONE_COUNTRIES.findIndex((c) => c.code === value),
          ),
    );
    const room = button.current ? roomAround(button.current) : undefined;
    setUp(Boolean(room && room.below < PANEL_HEIGHT && room.above > room.below));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function pick(country: string) {
    onChange(country);
    close();
  }

  function onButtonKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      show(e.key);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show("");
    }
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Never the form's submit: Enter picks here.
      e.preventDefault();
      const country = results[active];
      if (country) pick(country.code);
    } else if (e.key === "Escape") {
      // Marked handled, so the sheet around the list stays open.
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${name} ${code ? formatCallingCode(code) : ""}`}
        onClick={() => (open ? setOpen(false) : show(""))}
        onKeyDown={onButtonKey}
        className={cn(
          "flex items-center gap-1.5 px-3 text-base text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          className,
        )}
      >
        <span aria-hidden className="text-lg leading-none">
          {flagOf(value)}
        </span>
        <span aria-hidden className="tabular-nums">
          {code ? formatCallingCode(code) : value}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          {...{ [OWN_ESCAPE]: "" }}
          className={cn(
            "absolute left-0 z-30 flex w-72 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)] ring-1 ring-foreground/10 duration-150 animate-in fade-in zoom-in-95",
            up ? "bottom-full mb-2 origin-bottom-left" : "top-full mt-2 origin-top-left",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border/60 px-3">
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-label="Search a country"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                results[active] ? `${listId}-${results[active]!.code}` : undefined
              }
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Country or code"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              // 16px, or iOS zooms in when it takes focus.
              className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label="Countries"
            // Positioned, so each row's offsetTop is measured from the list.
            className="relative max-h-56 overflow-y-auto overscroll-contain py-1"
          >
            {results.map((c, i) => {
              const dial = callingCodeOf(c.code)!;
              return (
                <li
                  key={c.code}
                  id={`${listId}-${c.code}`}
                  role="option"
                  aria-selected={c.code === value}
                  data-index={i}
                  // Keep the focus in the search while the pointer picks.
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerMove={() => setActive(i)}
                  onClick={() => pick(c.code)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                    i === active && "bg-muted",
                  )}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {flagOf(c.code)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatCallingCode(dial)}
                  </span>
                  <Check
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-primary",
                      c.code === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </li>
              );
            })}
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No country matches
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** About how tall the open list is: the search, the rows, and the gap to the button. */
const PANEL_HEIGHT = 290;

/**
 * The room below and above an element, inside what would clip it: the
 * nearest scrolling or clipping box, such as a sheet or a phone screen, or
 * else the window.
 */
function roomAround(el: HTMLElement): { below: number; above: number } {
  let clip = el.parentElement;
  while (clip && !/(auto|scroll|hidden|clip)/.test(getComputedStyle(clip).overflowY)) {
    clip = clip.parentElement;
  }
  const box = el.getBoundingClientRect();
  const bounds = clip?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
  return { below: bounds.bottom - box.bottom, above: box.top - bounds.top };
}
