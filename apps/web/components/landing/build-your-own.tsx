import { Button } from "@goat-wallet/ui";
import { BrandSwitcher } from "./brand-switcher";
import { GITHUB_URL } from "./links";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Section `#build`: the developer pitch on the left, the brand demo phone on the right. */
export function BuildYourOwn() {
  return (
    <Section id="build" className="border-t border-border/70">
      <Reveal>
        <BrandSwitcher
          intro={
            <div className="flex flex-col items-start gap-4">
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Build your own today</h2>
              <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Use Crossmint APIs to add Agent Cards, Agent Checkouts and adapters to your product. Copy the parts you need from the GOAT template and make it feel your own.
              </p>
            </div>
          }
          cta={
            <Button asChild size="lg">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <GitHubMark className="size-5" />
                See on GitHub
              </a>
            </Button>
          }
        />
      </Reveal>
    </Section>
  );
}

/** The GitHub octocat mark, in the current text color. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-1.97c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
