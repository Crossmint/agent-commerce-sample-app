import Link from "next/link";
import { Button } from "@agent-commerce/ui";
import { Reveal } from "./reveal";
import { Section } from "./section";

/** Section `#try`: one wide card with the pitch and the way in. */
export function TryLive() {
  return (
    <Section id="try" className="py-8 sm:py-12">
      <Reveal>
        <div className="flex flex-col gap-8 rounded-2xl bg-card p-7 ring-1 ring-foreground/10 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="flex max-w-xl flex-col gap-3">
            <h2 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-foreground sm:text-[36px]">
              Try it live
            </h2>
            <p className="text-base text-muted-foreground sm:text-lg">
              Log in, save a card, and let the agent buy a snack, book a table, or get tickets for
              an event. All purchases are real purchases. Every experience runs on the same APIs.
            </p>
          </div>
          <Button asChild size="xl" className="w-full shrink-0 sm:w-auto sm:min-w-[14rem]">
            <Link href="/app">Open the example app</Link>
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
