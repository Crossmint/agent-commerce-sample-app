import { ArrowRight } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import { BrandSwitcher } from "./brand-switcher";
import { GITHUB_URL } from "./links";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/** Section `#build`: the developer pitch, then the brand demo. */
export function BuildYourOwn() {
  return (
    <Section id="build" className="border-t border-border/70">
      <SectionHeading title="Start building today" />
      <Reveal className="-mt-6 mb-16 flex flex-col items-start gap-6 sm:-mt-8 sm:mb-20">
        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Use Crossmint APIs to add saved cards, agent budgets, and checkouts to your product. Copy the parts you need from the GOAT template.
        </p>
        <Button asChild size="lg">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            Get the code <ArrowRight />
          </a>
        </Button>
      </Reveal>

      <Reveal className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">Make it feel like your brand</h3>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">See examples of how this could look in your platform</p>
        </div>
        <BrandSwitcher />
      </Reveal>
    </Section>
  );
}
