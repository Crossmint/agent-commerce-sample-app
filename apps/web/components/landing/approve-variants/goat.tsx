import { ApproveAgentCardPreview } from "@goat-wallet/ui";
import type { ApproveLayoutProps } from "./types";

/**
 * GOAT layout: one centered card. Headline, Purpose and Limit lines, a card
 * select, the lock line, a full-width Allow and a quiet Deny. This is the
 * `ApproveAgentCardPreview` from `@goat-wallet/ui`, sized down to fit a phone.
 */
export function GoatApprove({ agentName = "Your agent" }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col justify-center bg-background p-2.5 text-foreground">
      {/* Sized to fit a 250px phone: smaller type, tighter gaps, a shorter button. */}
      <ApproveAgentCardPreview
        agentName={agentName}
        className="max-w-none gap-3 rounded-md p-4 shadow-none sm:p-4 [&>p:first-child]:text-base sm:[&>p:first-child]:text-base [&_dl]:gap-y-1.5 [&_dl]:text-xs [&>p:last-of-type]:text-xs [&_button]:h-11 [&_button]:text-sm"
      />
    </div>
  );
}
