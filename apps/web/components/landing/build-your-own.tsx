import { GitHubMark } from "./social-marks";
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

