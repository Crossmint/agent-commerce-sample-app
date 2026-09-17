/** Agents you can connect GOAT to. Logo sources are listed in public/logos/SOURCES.md. */
export interface AgentLogo {
  name: string;
  /** Who makes it. Shown small under the name. */
  by?: string;
  src: string;
  /** Internal link. Only the example agent has one. */
  href?: string;
  /** The file carries its own colors (the Crossmint Agents mark). Other marks are one color and take the text color. */
  colored?: boolean;
}

export const AGENT_LOGOS: AgentLogo[] = [
  { name: "ChatGPT", by: "OpenAI", src: "/logos/openai.svg" },
  { name: "Grok", by: "xAI", src: "/logos/grok.svg" },
  { name: "Claude", by: "Anthropic", src: "/logos/claude.svg" },
  { name: "Claude Code", by: "Anthropic", src: "/logos/claude-code.svg" },
  { name: "OpenClaw", src: "/logos/openclaw.svg" },
  { name: "Hermes", by: "Nous Research", src: "/logos/hermes.svg" },
  { name: "GOAT example agent", src: "/brand/agents/crossmint-agents-mark.svg", href: "/chat", colored: true },
];
