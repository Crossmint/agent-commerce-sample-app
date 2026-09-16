import { ApproveAgentCardPreview } from "@goat-wallet/ui";
import type { ApproveLayoutProps } from "./types";

/**
 * GOAT layout: one centered card. Headline, Purpose and Limit lines, a card
 * select, the lock line, a full-width Allow and a quiet Deny. This is the
 * `ApproveAgentCardPreview` from `@goat-wallet/ui`, unchanged.
 */
export function GoatApprove({ agentName = "Your agent" }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col justify-center bg-background p-3 text-foreground">
      <ApproveAgentCardPreview
        agentName={agentName}
        className="max-w-none gap-4 p-5 shadow-none sm:p-5 [&>p:first-child]:text-lg sm:[&>p:first-child]:text-lg"
      />
    </div>
  );
}
