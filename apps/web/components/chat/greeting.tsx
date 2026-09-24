import { AGENT_NAME, AgentAvatar } from "@/components/brand";
import { StarterCards } from "./starters";

/**
 * The empty state of a new chat on a desktop: the agent's face, the question
 * it asks, and three ways to start.
 */
export function Greeting({ onPick }: { onPick?: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-2xl flex-col items-start gap-6">
        <AgentAvatar size={56} />
        <div className="flex flex-col items-start gap-2">
          <h1 className="text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-balance text-foreground">
            Hi, I am {AGENT_NAME}. What can I get you?
          </h1>
          <p className="max-w-prose text-base text-muted-foreground">
            I can set up an agent card, buy from any online store, book a table, or get you tickets.
            You choose how to pay when I get to the checkout. I never see your card number.
          </p>
        </div>
        {onPick ? <StarterCards layout="grid" onPick={onPick} /> : null}
      </div>
    </div>
  );
}
