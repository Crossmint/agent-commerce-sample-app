import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SiteHeader } from "./site-header";

/**
 * The page every device mockup stands on, as in the onramp sample app: the
 * dot grid canvas, the logo card fixed top left, the mockup centered, and
 * "Powered by Crossmint" at the foot. `top` is an optional element fixed at
 * the top center, for the experience switcher. On a phone the chrome goes
 * and the mockup fills the screen.
 *
 * The page takes the viewport: `h-dvh` and no scrolling, so the mockup is
 * the only thing that moves.
 */
export function FramePage({ children, top, className }: { children: ReactNode; top?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-dvh flex-col overflow-hidden", className)}>
      <main className="relative mx-auto flex min-h-0 w-full flex-1 flex-col items-center justify-center md:max-w-7xl md:p-6">
        <div className="fixed top-6 left-6 z-10 hidden md:flex">
          <SiteHeader />
        </div>

        {top}

        {children}

        <Image
          src="/powered-by-crossmint.svg"
          alt="Powered by Crossmint"
          width={209}
          height={19}
          className="fixed right-3 bottom-6 hidden h-auto w-[180px] md:block 2xl:absolute 2xl:right-auto 2xl:left-1/2 2xl:w-[230px] 2xl:-translate-x-1/2"
        />
      </main>
    </div>
  );
}
