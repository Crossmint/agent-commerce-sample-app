import type { CSSProperties } from "react";
import { ApproveAgentCardPreview } from "@goat-wallet/ui";
import type { ApproveLayoutProps } from "./types";

/** The template's own theme: dark warm ground, one orange accent, square corners. */
const theme = {
  "--background": "#14140f",
  "--foreground": "#f3efe6",
  "--card": "#1c1c15",
  "--card-foreground": "#f3efe6",
  "--primary": "#e8632b",
  "--primary-foreground": "#fff8f2",
  "--muted-foreground": "#a39e90",
  "--border": "#2f2f26",
  "--input": "#34342a",
  "--radius": "0.375rem",
  "--radius-button": "0.375rem",
} as CSSProperties;

/**
 * The generic template screen: `ApproveAgentCardPreview` from
 * `@goat-wallet/ui`, the same component adopters drop into their page, sized
 * down to fit a phone.
 */
export function GoatApprove({ agentName = "Your agent" }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col justify-center bg-background p-2.5 text-foreground" style={theme}>
      <ApproveAgentCardPreview
        agentName={agentName}
        className="max-w-none gap-3 rounded-md p-4 shadow-none sm:p-4 [&>p:first-child]:text-base sm:[&>p:first-child]:text-base [&_dl]:gap-y-1.5 [&_dl]:text-xs [&>p:last-of-type]:text-xs [&_button]:h-11 [&_button]:text-sm"
      />
    </div>
  );
}
