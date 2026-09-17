import { GitHubMark } from "./social-marks";
import { Button } from "@goat-wallet/ui";
import { BrandSwitcher } from "./brand-switcher";
import { GITHUB_URL } from "./links";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Section `#build`: the pitch on the left, the example platforms demo on the right. */
export function BuildYourOwn() {
  return (
    <Section id="build">
      <Reveal>
        <BrandSwitcher
          intro={
            <div className="flex flex-col items-start gap-4">
              <h2 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">Your brand, your users.</h2>
              <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Add agent cards and agent checkouts to your agent platform. Copy the parts you need from the GOAT template and make it feel your own with your own components.
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

