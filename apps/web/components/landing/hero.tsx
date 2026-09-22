import type { CSSProperties } from "react";
import Link from "next/link";
import { Button } from "@agent-commerce/ui";
import { CrossmintMark } from "@/components/brand";
import { GITHUB_URL } from "./links";
import { PoweredBy } from "./powered-by";
import { Container } from "./section";
import { GitHubMark } from "./social-marks";
import { StoryPhone } from "./story-phone";

const rise = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

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
            <h1 className="landing-rise max-w-[15ch] text-[44px] leading-[1.05] font-medium tracking-[-0.02em] text-foreground sm:text-[56px]" style={rise(60)}>
              All the APIs you need to enable agentic commerce for your agent platform
            </h1>
            <p className="landing-rise max-w-xl text-lg leading-snug text-muted-foreground sm:text-xl" style={rise(110)}>
              Save your users&rsquo; cards, let agents ask for spending limits, and check out at any store. An open source sample app on the Crossmint Agents APIs.
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
