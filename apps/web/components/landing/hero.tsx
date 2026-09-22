import type { CSSProperties } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@agent-commerce/ui";
import { CrossmintMark } from "@/components/brand";
import { GITHUB_URL } from "./links";
import { PoweredBy } from "./powered-by";
import { Container } from "./section";
import { GitHubMark } from "./social-marks";
import { StoryPhone } from "./story-phone";

const rise = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/** The three things the sample app shows how to do. */
const WHAT_IT_SHOWS = [
  "Save your users’ cards",
  "Create secure spending limits",
  "Check out at any store",
];

/**
 * The hero: the pitch on the left, the phone playing the story on the
 * right, the powered-by strip under both. Plain on the canvas: no band, no
 * rules, spacing only.
 */
export function Hero() {
  return (
    <section className="relative">
      <Container>
        <div className="grid items-center gap-12 pt-10 pb-8 sm:pt-16 lg:grid-cols-[1.25fr_1fr] lg:gap-10 lg:pt-20">
          <div className="flex flex-col items-start gap-6">
            <span className="landing-rise inline-flex h-8 items-center gap-2 rounded-full bg-muted pr-3.5 pl-2 text-[13px] font-medium text-muted-foreground" style={rise(0)}>
              <CrossmintMark size={16} />
              Agent Commerce Sample App
            </span>
            <h1 className="landing-rise max-w-[16ch] text-[44px] leading-[1.05] font-medium tracking-[-0.02em] text-foreground sm:text-[56px]" style={rise(60)}>
              All the APIs you need for agentic commerce.
            </h1>
            <div className="landing-rise flex max-w-xl flex-col gap-3" style={rise(110)}>
              <p className="text-lg leading-snug text-muted-foreground sm:text-xl">
                An open source sample app that showcases how you can enable your agents to:
              </p>
              <ul className="flex flex-col gap-2 text-lg leading-snug text-foreground sm:text-xl">
                {WHAT_IT_SHOWS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-1.5 size-4 shrink-0 text-primary sm:mt-2" strokeWidth={3} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="landing-rise max-w-xl text-lg leading-snug text-muted-foreground sm:text-xl" style={rise(150)}>
              Build your own alternative to Stripe Link.{" "}
              <span className="text-foreground">Your users, your brand.</span>
            </p>
            <div className="landing-rise flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row" style={rise(200)}>
              <Button asChild size="xl" className="sm:min-w-[11rem]">
                <Link href="/app">Try it live</Link>
              </Button>
              <Button asChild size="xl" variant="secondary" className="sm:min-w-[11rem]">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GitHubMark className="size-5" data-icon="inline-start" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>

          <StoryPhone className="landing-rise justify-center lg:justify-end" />
        </div>

        <div className="py-8 sm:py-10">
          <PoweredBy />
        </div>
      </Container>
    </section>
  );
}
