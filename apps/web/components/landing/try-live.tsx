import Link from "next/link";
import { MessageCircle, Monitor, Plug, Smartphone, Terminal } from "lucide-react";
import { Button } from "@agent-commerce/ui";
import { Reveal } from "./reveal";
import { Section } from "./section";

const VIEWS = [
  { view: "mobile", label: "Mobile", Icon: Smartphone },
  { view: "desktop", label: "Desktop", Icon: Monitor },
  { view: "messaging", label: "Messaging apps", Icon: MessageCircle },
  { view: "mcp", label: "Agent MCP", Icon: Plug },
  { view: "cli", label: "CLI skill", Icon: Terminal },
] as const;

/** Section `#try`: one wide card with the way in and a chip per experience. */
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
              Log in, save a test card, and let the agent buy something. Every experience runs on
              the same APIs.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 lg:items-end">
            <Button asChild size="xl" className="w-full sm:w-auto sm:min-w-[12rem]">
              <Link href="/app">Open the app</Link>
            </Button>
            <ul className="flex flex-wrap gap-1.5 lg:justify-end" aria-label="Experiences">
              {VIEWS.map(({ view, label, Icon }) => (
                <li key={view}>
                  <Link
                    href={`/app?view=${view}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted-strong"
                  >
                    <Icon className="size-3.5 text-muted-foreground" strokeWidth={2} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
