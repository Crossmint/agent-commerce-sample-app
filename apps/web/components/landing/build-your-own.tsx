import { ArrowRight } from "lucide-react";
import { Button } from "@goat-wallet/ui";
import { BrandSwitcher } from "./brand-switcher";
import { DOCS_URL, GITHUB_URL } from "./links";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/** Section `#build`: the developer pitch, then the brand demo. */
export function BuildYourOwn() {
  return (
    <Section id="build" className="border-t border-border/70">
      <SectionHeading title="Integrate agent cards and agent checkouts into your platform" />
      <Reveal className="-mt-6 mb-16 flex flex-col items-center gap-6 text-center sm:-mt-8 sm:mb-20">
        <p className="max-w-2xl text-lg text-muted-foreground text-balance sm:text-xl">
          Use Crossmint APIs to add saved cards, agent budgets, and checkouts to your product. Copy the parts you need from the GOAT template.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              Get the code <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              Read the docs
            </a>
          </Button>
        </div>
      </Reveal>

      <Reveal className="flex flex-col gap-8">
        <h3 className="text-center text-3xl font-bold tracking-tight text-balance sm:text-4xl">Customize it as you want</h3>
        <BrandSwitcher />
      </Reveal>
    </Section>
  );
}
