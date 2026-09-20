import type { Metadata } from "next";
import { BuildYourOwn } from "@/components/landing/build-your-own";
import { CorePieces } from "@/components/landing/core-pieces";
import { GridRule } from "@/components/landing/grid";
import { Hero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { TryLive } from "@/components/landing/try-live";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "GOAT by Crossmint" },
  description: "An open source template to create your own evolved version of Stripe's Link. Powered by Crossmint.",
};

/**
 * Public marketing page. The wallet lives at /wallet.
 *
 * One root element on purpose. Arriving here from another page, the router
 * scrolls the new page into view; with several roots it picked the footer and
 * the page opened at the very bottom.
 */
export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingNav />
      <main className="landing flex flex-1 flex-col">
        <Hero />
        <GridRule />
        <CorePieces />
        <GridRule />
        <TryLive />
        <GridRule />
        <BuildYourOwn />
      </main>
      <GridRule />
      <LandingFooter />
    </div>
  );
}
