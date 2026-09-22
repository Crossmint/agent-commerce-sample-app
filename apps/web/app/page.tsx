import type { Metadata } from "next";
import { Experiences } from "@/components/landing/experiences";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { MakeItYours } from "@/components/landing/make-it-yours";
import { TryLive } from "@/components/landing/try-live";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: { absolute: "Agent Commerce Sample App" },
  description:
    "All the APIs you need to enable agentic commerce for your agent platform. An open source sample app by Crossmint.",
};

/**
 * The public page. The app lives at /app.
 *
 * One root element on purpose. Arriving here from another page, the router
 * scrolls the new page into view; with several roots it picked the footer
 * and the page opened at the very bottom.
 */
export default function LandingPage() {
  return (
    <div className="landing flex flex-1 flex-col bg-app-canvas">
      <LandingNav />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HowItWorks />
        <Experiences />
        <MakeItYours />
        <TryLive />
        <Faq />
      </main>
      <LandingFooter />
    </div>
  );
}
