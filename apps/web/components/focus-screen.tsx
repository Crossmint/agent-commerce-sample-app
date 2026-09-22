import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { CrossmintLogo } from "@/components/brand";
import { DeviceFrame } from "@/components/frame/device-frame";
import { FramePage } from "@/components/frame/frame-page";
import { PhoneStatusBar } from "@/components/frame/phone-status-bar";

/**
 * The ground every screen outside the app stands on: sign in, authorize an
 * agent, approve a budget, the CLI callback, and the page that is not there.
 * As in the onramp sample app, each one is a phone on the dot grid canvas
 * with the logo card top left; on a phone the screen fills the viewport.
 *
 * `width` is kept for callers; every screen is the phone now, so it changes
 * nothing. `footer` renders under the screen's content, inside the phone.
 */
export function FocusScreen({
  footer,
  children,
  scroll = true,
}: {
  /** Kept for callers that used to ask for a wider cell. */
  width?: "md" | "lg";
  footer?: ReactNode;
  children: ReactNode;
  /** Let the screen scroll when the content runs long. Default true. */
  scroll?: boolean;
}) {
  return (
    <FramePage>
      <DeviceFrame className="flex-1 md:flex-none">
        <div className="relative flex h-full flex-col bg-background">
          <PhoneStatusBar />
          <div className={cn("flex min-h-0 flex-1 flex-col px-6 pb-8", scroll && "scrollbar-none overflow-y-auto")}>
            <div className="flex shrink-0 items-center pt-6 pb-2 md:pt-3">
              <Link href="/" aria-label="Agent Commerce Sample App home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <CrossmintLogo height={20} />
              </Link>
            </div>
            <div className="flex flex-1 flex-col gap-6 pt-6">{children}</div>
            {footer ? <div className="shrink-0 pt-6">{footer}</div> : null}
          </div>
        </div>
      </DeviceFrame>
    </FramePage>
  );
}

/** The step's name and one line under it, as on the onramp login screen. */
export function ScreenHeading({ title, sub, className }: { title: string; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <h1 className="text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-balance text-foreground">{title}</h1>
      {sub ? <p className="text-base text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
