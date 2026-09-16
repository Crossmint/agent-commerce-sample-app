import type { Metadata } from "next";
import { BrandsSection } from "@/components/landing/brands-section";
import { GetStarted } from "@/components/landing/get-started";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { Pillars } from "@/components/landing/pillars";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "GOAT Wallet" },
  description: "The open source, white-label evolution of Link. Your users save a card once. Your agents pay anywhere.",
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
        <BrandsSection />
      </main>
      <LandingFooter />
    </>
  );
}
