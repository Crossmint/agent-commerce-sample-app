import type { Metadata } from "next";
import { GetStarted } from "@/components/landing/get-started";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { Pillars } from "@/components/landing/pillars";
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
      <main className="flex flex-1 flex-col">
        <Hero />
        <Pillars />
        <HowItWorks />
        <GetStarted />
      </main>
      <LandingFooter />
    </>
  );
}
