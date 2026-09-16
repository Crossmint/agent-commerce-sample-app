import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AGENT_LOGOS, type AgentLogo } from "./agent-logos";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/** Section `#try`: six agent tiles in one row, then the GOAT row that opens the example chat. */
export function TryLive() {
  const agents = AGENT_LOGOS.filter((a) => !a.href);
  const goat = AGENT_LOGOS.find((a) => a.href);
  return (
    <Section id="try" className="border-t border-border/70">
      <SectionHeading
        title="Try a live implementation"
        sub={
          <>
            or{" "}
            <Link href="#build" className="text-primary underline-offset-4 hover:underline">
              build your own
            </Link>
          </>
        }
      />
      <Reveal className="flex flex-col gap-3">
        <ul className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
          {agents.map((a) => (
            <li key={a.name} className="flex min-w-0">
              <AgentTile agent={a} />
            </li>
          ))}
        </ul>
        {goat?.href ? (
          <Link
            href={goat.href}
            className="landing-tile flex w-full items-center gap-3 rounded-md border border-primary/40 bg-black/40 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:gap-4 sm:p-4"
            aria-label="GOAT agent: try the example chat"
          >
            <Image src={goat.src} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-contain" />
            <span className="min-w-0 flex-1 text-sm leading-tight font-semibold sm:text-base">
              GOAT agent, <span className="text-primary">try the example chat</span>
            </span>
            <ArrowUpRight className="size-5 shrink-0 text-primary" />
          </Link>
        ) : null}
      </Reveal>
    </Section>
  );
}

/** A square tile: logo top left, name bottom left. */
function AgentTile({ agent }: { agent: AgentLogo }) {
  return (
    <div className="landing-tile flex aspect-square w-full min-w-0 flex-col items-start justify-between gap-3 rounded-md border border-border bg-black/40 p-3">
      <Image src={agent.src} alt="" width={40} height={40} className="size-8 shrink-0 object-contain sm:size-10" />
      <span className="w-full truncate text-left text-[13px] leading-tight font-semibold sm:text-sm">{agent.name}</span>
    </div>
  );
}
