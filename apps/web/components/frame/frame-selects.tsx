"use client";

import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@agent-commerce/ui";
import { BRAND_THEME_META, BRAND_THEMES, type BrandTheme } from "@/components/brand-themes";
import { cn } from "@/lib/cn";
import { Swatch } from "./brand-picker";
import { HEADER_ENTER_DELAY_MS } from "./site-header";
import {
  MESSAGING_APP_META,
  MESSAGING_APPS,
  type MessagingApp,
  VIEW_META,
  VIEWS,
  type View,
} from "./views";

/*
 * The two controls over a framed page: the platform the app is shown
 * through, and the template its screens wear.
 *
 * Both are menus, not tab strips — five platforms and three templates do not
 * fit a phone as pills. The messaging platform is a choice inside a choice,
 * so it is a submenu of the platform menu rather than a second control beside
 * it: picking iMessage there both moves to the messaging platform and names
 * the app, in one gesture, which is one change for the caller to make.
 *
 * The card repeats `SiteHeader`'s shell and its 40px buttons, and enters on
 * the same animation and the same delay, because it sits immediately beside
 * it and the two should arrive as one row.
 */

const CARD =
  "flex items-center gap-1.5 rounded-[10px] border border-border bg-background/80 p-1.5 backdrop-blur";

const BUTTON =
  "flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-[0px_1px_2px_rgba(0,0,0,0.05)] transition-shadow outline-none hover:shadow-[0px_2px_6px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-ring";

const ROW = "gap-2.5 py-2.5 pr-8 pl-2.5 text-sm";

/** The platform and template menus, in one card beside the logo card. */
export function FrameControls({
  view,
  app,
  brand,
  onView,
  onApp,
  onBrand,
  hideViews,
  animate = false,
  className,
}: {
  view: View;
  app: MessagingApp;
  brand: BrandTheme;
  onView: (view: View) => void;
  onApp: (app: MessagingApp) => void;
  onBrand: (brand: BrandTheme) => void;
  /**
   * Platforms to leave out, for a phone that should not offer the desktop
   * frame. A hidden platform still lists while it is the current one, so the
   * menu always has a row that answers the button. The menu contents portal
   * to the body, so this cannot be done by hiding rows with CSS.
   */
  hideViews?: readonly View[];
  /** Enter from the top with the logo card. False in the phone's foot bar, which is not up there. */
  animate?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(CARD, animate && "enter-down enter-down-far", className)}
      style={animate ? { animationDelay: `${HEADER_ENTER_DELAY_MS}ms` } : undefined}
    >
      <PlatformMenu view={view} app={app} onView={onView} onApp={onApp} hideViews={hideViews} />
      <TemplateMenu brand={brand} onBrand={onBrand} />
    </div>
  );
}

function PlatformMenu({
  view,
  app,
  onView,
  onApp,
  hideViews,
}: {
  view: View;
  app: MessagingApp;
  onView: (view: View) => void;
  onApp: (app: MessagingApp) => void;
  hideViews?: readonly View[];
}) {
  const messaging = view === "messaging";
  const { label, icon: Icon } = VIEW_META[view];
  const current = messaging ? MESSAGING_APP_META[app] : null;
  const shown = VIEWS.filter((v) => v === view || !hideViews?.includes(v));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Platform" className={BUTTON}>
        {/* On the messaging platform the chat app is what is on screen, so it names the button. */}
        {current ? (
          <AppLogo src={current.logo} alt="" />
        ) : (
          <Icon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{current ? current.label : label}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {shown.map((v) => {
          const meta = VIEW_META[v];
          const ItemIcon = meta.icon;
          if (v === "messaging") {
            return (
              <DropdownMenuSub key={v}>
                <DropdownMenuSubTrigger className={ROW}>
                  <ItemIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{meta.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="min-w-44">
                    {MESSAGING_APPS.map((id) => (
                      <DropdownMenuItem key={id} onSelect={() => onApp(id)} className={ROW}>
                        <AppLogo src={MESSAGING_APP_META[id].logo} alt="" />
                        <span className="flex-1">{MESSAGING_APP_META[id].label}</span>
                        <Mark on={messaging && id === app} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            );
          }
          return (
            <DropdownMenuItem key={v} onSelect={() => onView(v)} className={ROW}>
              <ItemIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{meta.label}</span>
              <Mark on={v === view} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TemplateMenu({
  brand,
  onBrand,
}: {
  brand: BrandTheme;
  onBrand: (brand: BrandTheme) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Template" className={BUTTON}>
        <Swatch colors={BRAND_THEME_META[brand].swatch} />
        <span className="truncate">{BRAND_THEME_META[brand].name}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {BRAND_THEMES.map((id) => (
          <DropdownMenuItem key={id} onSelect={() => onBrand(id)} className={ROW}>
            <Swatch colors={BRAND_THEME_META[id].swatch} />
            <span className="flex-1">{BRAND_THEME_META[id].name}</span>
            <Mark on={id === brand} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A chat app's own mark, in its own color. */
function AppLogo({ src, alt }: { src: string; alt: string }) {
  return <Image src={src} alt={alt} width={16} height={16} className="size-4 shrink-0" />;
}

/** The check on the row that is current. It holds its space, so rows do not shift. */
function Mark({ on }: { on: boolean }) {
  return (
    <span className="absolute right-2.5 flex size-4 items-center justify-center">
      {on ? <Check aria-hidden className="size-4 text-primary" /> : null}
    </span>
  );
}
