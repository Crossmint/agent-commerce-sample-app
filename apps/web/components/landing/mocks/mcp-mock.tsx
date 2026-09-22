import { Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { MaskLogo } from "../mask-logo";
import { STORY } from "../story";
import { WindowMock } from "./window-mock";

/*
 * Acme's MCP server: the one block of settings JSON an agent host needs,
 * the tools it then sees, and the hosts people already run. Static.
 */

const TOOLS = [
  "list_payment_methods",
  "request_agent_card",
  "get_agent_card",
  "create_checkout",
  "get_checkout",
  "answer_checkout",
];

const HOSTS: Array<{ name: string; logo: string }> = [
  { name: "Claude", logo: "/logos/claude.svg" },
  { name: "ChatGPT", logo: "/logos/openai.svg" },
  { name: "Cursor", logo: "/logos/cursor.svg" },
  { name: "Claude Code", logo: "/logos/claude-code.svg" },
  { name: "Grok Bot", logo: "/logos/grok-bot.svg" },
];

export function McpMock({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <WindowMock address="Settings · MCP servers" className="text-[12px] sm:aspect-[16/11]">
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <pre className="m-0 min-h-0 flex-1 overflow-hidden p-4 font-mono text-[11px] leading-[1.65] whitespace-pre-wrap break-all text-foreground sm:text-[11.5px]">
            <Dim>{"{\n  "}</Dim>
            <Key>&quot;mcpServers&quot;</Key>
            <Dim>{": {\n    "}</Dim>
            <Key>&quot;{STORY.company.toLowerCase()}&quot;</Key>
            <Dim>{": {\n      "}</Dim>
            <Key>&quot;url&quot;</Key>
            <Dim>{": "}</Dim>
            <span className="text-primary">&quot;{STORY.mcpUrl}&quot;</span>
            <Dim>{"\n    }\n  }\n}"}</Dim>
          </pre>
          <div className="flex shrink-0 flex-col gap-1 border-t border-border bg-app-canvas p-3 sm:w-[44%] sm:border-t-0 sm:border-l">
            <p className="px-1.5 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              6 tools
            </p>
            {TOOLS.map((t) => (
              <span
                key={t}
                className="flex h-6 items-center gap-2 rounded-md px-1.5 font-mono text-[10.5px] text-foreground"
              >
                <Wrench className="size-3 shrink-0 text-muted-foreground" strokeWidth={2} />
                <span className="truncate">{t}</span>
              </span>
            ))}
          </div>
        </div>
      </WindowMock>
      <ul className="flex flex-wrap gap-1.5" aria-label="Works with">
        {HOSTS.map((h) => (
          <li
            key={h.name}
            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-card px-2.5 text-[12px] font-medium text-foreground ring-1 ring-foreground/10"
          >
            <MaskLogo src={h.logo} label="" className="size-3.5" />
            {h.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground">{children}</span>;
}
function Dim({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
