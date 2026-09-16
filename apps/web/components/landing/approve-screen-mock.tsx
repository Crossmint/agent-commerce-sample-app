import { ApproveAgentCardPreview } from "@goat-wallet/ui";
import { cn } from "@/lib/cn";

export interface ApproveScreenMockProps {
  agentName?: string;
  className?: string;
}

/** The approval screen in a small window frame. Purely visual. */
export function ApproveScreenMock({ agentName = "GOAT", className }: ApproveScreenMockProps) {
  return (
    <div className={cn("goat-window mx-auto w-full max-w-sm", className)}>
      <ApproveAgentCardPreview agentName={agentName} className="max-w-none rounded-none border-0 shadow-none" />
    </div>
  );
}
