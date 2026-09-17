import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { AGENT_LOGOS, type AgentLogo } from "./agent-logos";
import { GridNode } from "./grid";
import { MaskLogo } from "./mask-logo";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const COLS = 3;

/**
 * Section `#try`. Title on the left; on the right the agents in the site's
 * hairline grid, three across: two rows of agent tiles, then the GOAT row
 * that opens the example chat. A green diamond marks every line crossing,
 * and a tile fills with green pixels on hover.
 */
export function TryLive() {
  const agents = AGENT_LOGOS.filter((a) => !a.href);
  const goat = AGENT_LOGOS.find((a) => a.href);
  return (
    <Section id="try">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
        <SectionHeading
          className="mb-0 sm:mb-0"
          title="Try it live"
          sub={
            <>
              or{" "}
              <Link href="#build" className="text-primary underline-offset-4 hover:underline">
                build your own
              </Link>
            </>
          }
        />
        <Reveal>
          <ul className="grid border-t border-l border-hairline" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
            {agents.map((a, i) => (
              <li key={a.name} className="relative flex min-w-0 border-r border-b border-hairline">
                <GridNode className="absolute top-0 left-0 z-10 -translate-x-1/2 -translate-y-1/2" />
                {i % COLS === COLS - 1 ? <GridNode className="absolute top-0 right-0 z-10 translate-x-1/2 -translate-y-1/2" /> : null}
                <AgentTile agent={a} />
              </li>
            ))}
            {goat?.href ? (
              <li className="relative flex min-w-0 border-r border-b border-hairline" style={{ gridColumn: `span ${COLS}` }}>
                {/* The verticals from the rows above end on this edge: mark those crossings too. */}
                <GridNode className="absolute top-0 left-0 z-10 -translate-x-1/2 -translate-y-1/2" />
                <GridNode className="absolute top-0 left-1/3 z-10 -translate-x-1/2 -translate-y-1/2" />
                <GridNode className="absolute top-0 left-2/3 z-10 -translate-x-1/2 -translate-y-1/2" />
                <GridNode className="absolute top-0 right-0 z-10 translate-x-1/2 -translate-y-1/2" />
                <GridNode className="absolute bottom-0 left-0 z-10 -translate-x-1/2 translate-y-1/2" />
                <GridNode className="absolute bottom-0 right-0 z-10 translate-x-1/2 translate-y-1/2" />
                <Link
                  href={goat.href}
                  className="landing-pixel relative flex w-full items-center gap-3 p-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset sm:gap-4 sm:p-5"
                  aria-label="GOAT example agent: try the example chat"
                >
                  <Image src={goat.src} alt="" width={40} height={40} className="relative size-9 shrink-0 object-contain sm:size-10" />
                  <span className="relative min-w-0 flex-1 text-sm leading-tight font-semibold sm:text-base">
                    GOAT example agent, <span className="text-primary">try the example chat</span>
                  </span>
                  <ArrowUpRight className="relative size-5 shrink-0 text-primary" />
                </Link>
              </li>
            ) : null}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}

/**
 * A square grid cell: logo top left, name bottom left. One-color marks
 * render as CSS masks in the text color, so they read navy on the ground.
 */
function AgentTile({ agent }: { agent: AgentLogo }) {
  return (
    <div className={cn("landing-pixel relative flex aspect-square w-full min-w-0 flex-col items-start justify-between gap-3 p-3 text-foreground sm:p-4")}>
      {agent.colored ? (
        <Image src={agent.src} alt="" width={40} height={40} className="relative size-8 shrink-0 object-contain sm:size-10" />
      ) : (
        <MaskLogo src={agent.src} label="" className="relative size-8 sm:size-10" />
      )}
      <span className="relative w-full truncate text-left text-[13px] leading-tight font-semibold sm:text-sm">{agent.name}</span>
    </div>
  );
}
