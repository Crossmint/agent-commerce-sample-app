import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { AGENT_LOGOS, type AgentLogo } from "./agent-logos";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/** Section `#try`: a banner of agent tiles. The GOAT tile opens the example chat. */
export function TryLive() {
  return (
    <Section id="try" className="border-t border-border/70">
      <SectionHeading
        title="Try a live implementation"
        sub={
          <>
            Try a live deployment, or{" "}
            <Link href="#build" className="text-primary underline-offset-4 hover:underline">
              build your own
            </Link>
            .
          </>
        }
      />
      <Reveal className="flex flex-col gap-5">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
          {AGENT_LOGOS.map((a) => (
            <li key={a.name} className={cn("flex min-w-0", a.href && "col-span-3 sm:col-span-2 lg:col-span-1")}>
              <AgentTile agent={a} />
            </li>
          ))}
        </ul>
        <p className="text-center font-mono text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
          MCP endpoint: goat-jade.vercel.app/api/mcp · CLI: npm i -g goat
        </p>
      </Reveal>
    </Section>
  );
}

function AgentTile({ agent }: { agent: AgentLogo }) {
  const isGoat = Boolean(agent.href);
  const cls = cn(
    "landing-tile flex w-full min-w-0 items-center justify-center gap-3 rounded-md border border-border bg-black/40 p-3",
    // Regular tiles are squares. The GOAT tile spans a row on small screens, so
    // it lays out as a row there and becomes a square at the 7-across size.
    isGoat ? "flex-row border-primary/40 lg:aspect-square lg:flex-col lg:gap-2.5" : "aspect-square flex-col gap-2.5",
  );
  const body = (
    <>
      <Image src={agent.src} alt="" width={40} height={40} className={cn("size-10 shrink-0 object-contain", isGoat && "rounded-full")} />
      <span className={cn("flex min-w-0 flex-col leading-tight", isGoat ? "text-left lg:text-center" : "text-center")}>
        <span className="truncate text-sm font-semibold">{agent.name}</span>
        {isGoat ? <span className="text-[11px] text-primary lg:hidden">Try the example chat</span> : null}
      </span>
      {isGoat ? <ArrowUpRight className="ml-auto size-4 shrink-0 text-primary lg:hidden" /> : null}
    </>
  );
  return agent.href ? (
    <Link href={agent.href} className={cn(cls, "outline-none focus-visible:ring-2 focus-visible:ring-ring/60")} aria-label={`${agent.name}: try the example chat`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
