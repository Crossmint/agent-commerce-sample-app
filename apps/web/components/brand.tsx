import Image from "next/image";
import { cn } from "@/lib/cn";

/*
 * Two identities live on the site.
 *
 * Crossmint is the maker of the sample app: its logotype sits in the page
 * chrome (the header card, the footer, "Powered by").
 *
 * Acme Agent is the made-up company that built the agent the user talks to.
 * Every agent surface (the chat contact, the approval screen, the CLI and
 * MCP examples on the landing, the example URLs) wears Acme, so a reader
 * sees at once that the agent is theirs, not Crossmint's.
 */

/** The agent's name, as the user sees it. */
export const AGENT_NAME = "Acme Agent";
/** The company behind the agent. */
export const AGENT_COMPANY = "Acme";
/** Where the agent's own site lives in every example URL. */
export const AGENT_DOMAIN = "acme.com";
/** The name the card network shows when it asks the user to confirm. It is the platform saving the card, not Crossmint. */
export const PLATFORM_NAME = AGENT_NAME;

/** The Crossmint logotype with the gradient mark, dark type. The file is 459x86. */
export function CrossmintLogo({
  height = 22,
  className,
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round((height * 459.17) / 85.97);
  return (
    <Image
      src="/crossmint.svg"
      alt="Crossmint"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto shrink-0", className)}
      style={{ width, height }}
    />
  );
}

/** The Crossmint mark on its own, the gradient four-leaf. */
export function CrossmintMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/crossmint-mark.svg"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Between the mark and the word, and the indent that keeps the second line under the word. */
const GAP = 8;

/**
 * The lockup the page chrome wears: the Crossmint leaf beside "agents" in the
 * display face, and who made it on the line below. It names the product,
 * where the bare logotype only named the company.
 *
 * `font-display` is the brand face (Mona Sans) on the site's own tokens. The
 * chrome is never inside a `data-brand` wrapper, so an example brand's face
 * cannot reach it.
 */
export function AgentsLockup({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex flex-col gap-[3px]", className)}
      aria-label="Agents by Crossmint"
    >
      {/* The mark sits on the word's line, not between the two lines. */}
      <span className="inline-flex items-center" style={{ gap: GAP }}>
        <CrossmintMark size={size} />
        <span
          aria-hidden
          className="font-display text-[17px] leading-none font-bold tracking-[-0.02em] text-foreground"
        >
          agents
        </span>
      </span>
      {/* Indented past the mark, so it starts under the word rather than the leaf. */}
      <span
        aria-hidden
        className="text-[10.5px] leading-none font-medium text-muted-foreground"
        style={{ paddingLeft: size + GAP }}
      >
        by Crossmint
      </span>
    </span>
  );
}

/**
 * Acme Agent's mark: a white A on an indigo tile. `shape` is the tile's
 * corner: "tile" keeps the app-icon rounding, "round" makes a disc, for the
 * contact avatar in a messaging app.
 */
export function AgentMark({
  size = 32,
  shape = "tile",
  className,
}: {
  size?: number;
  shape?: "tile" | "round";
  className?: string;
}) {
  return (
    <Image
      src="/logos/acme.svg"
      alt=""
      width={size}
      height={size}
      className={cn(
        "shrink-0 object-cover",
        shape === "round" ? "rounded-full" : "rounded-[25%]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Acme's logotype: the mark beside the company name. It stands where the
 * Crossmint one does on screens that belong to the agent rather than to
 * Crossmint — the OAuth consent screen is the agent asking for access, so it
 * wears the agent's brand.
 */
export function AgentLockup({ height = 20, className }: { height?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label={AGENT_NAME}>
      <AgentMark size={height} />
      <span
        aria-hidden
        className="text-[17px] leading-none font-semibold tracking-[-0.02em] text-foreground"
      >
        {AGENT_NAME}
      </span>
    </span>
  );
}

/** The agent's face in a conversation: the Acme mark as a disc. */
export function AgentAvatar({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={AGENT_NAME}
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <AgentMark size={size} shape="round" />
    </span>
  );
}
