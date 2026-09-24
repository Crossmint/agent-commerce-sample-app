import { AGENT_NAME, AgentAvatar } from "@/components/brand";
import { StarterCards } from "./starters";

/**
 * The empty state of a new chat on a desktop: the agent's face, the question
 * it asks, and three ways to start.
 */
export function Greeting({ onPick }: { onPick?: (text: string) => void }) {
  return (
    // Scrolls inside the window on a short one, so the composer below stays in view.
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-10 sm:px-6">
      <div className="my-auto flex w-full max-w-2xl flex-col items-start gap-6">
        <AgentAvatar size={56} />
        <h1 className="text-[28px] leading-[1.2] font-medium tracking-[-0.02em] text-balance text-foreground">
          Hi, I am {AGENT_NAME}. What can I get you?
        </h1>
        {onPick ? <StarterCards layout="grid" onPick={onPick} /> : null}
      </div>
    </div>
  );
}
