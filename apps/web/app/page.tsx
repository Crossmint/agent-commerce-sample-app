import type { Metadata } from "next";
import { BuildYourOwn } from "@/components/landing/build-your-own";
import { CorePieces } from "@/components/landing/core-pieces";
import { GridRule } from "@/components/landing/grid";
import { Hero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { PoweredBy } from "@/components/landing/powered-by";
import { TryLive } from "@/components/landing/try-live";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "GOAT Wallet" },
  description: "An open source template to create your own evolved version of Stripe's Link. Powered by Crossmint.",
};

/** Public marketing page. The wallet lives at /wallet. */
export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main className="landing flex flex-1 flex-col">
        <Hero />
        <GridRule />
        <PoweredBy />
        <GridRule />
        <CorePieces />
        <GridRule />
        <TryLive />
        <GridRule />
        <BuildYourOwn />
      </main>
      <GridRule />
      <LandingFooter />
    </>
  );
}
