import { ArrowUpRight } from "lucide-react";
import { AGENT_NAME, AgentAvatar } from "@/components/brand";

/**
 * The empty state of a new chat on a desktop: the agent's face, the question
 * it asks, and three ways to start.
 */
export function Greeting({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick?: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-xl flex-col items-start gap-6">
        <AgentAvatar size={56} />
        <div className="flex flex-col items-start gap-2">
          <h1 className="text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-balance text-foreground">
            Hi, I am {AGENT_NAME}. What should I buy for you?
          </h1>
          <p className="max-w-prose text-base text-muted-foreground">
            Send me a link and I will go buy it. You choose how to pay when I get to the checkout. I
            never see your card number.
          </p>
        </div>
        {onPick ? (
          <ul className="flex w-full flex-col gap-2" aria-label="Suggestions">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted-strong"
                >
                  <span className="min-w-0 truncate">{s}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
