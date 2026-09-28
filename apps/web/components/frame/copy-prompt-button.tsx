"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@agent-commerce/ui";
import { GITHUB_URL } from "@/components/landing/links";
import { BUILD_PROMPT } from "@/lib/build-prompt";
import { cn } from "@/lib/cn";
import { HEADER_ENTER_DELAY_MS } from "./site-header";

/** Where the prompt is written out, for a browser that will not copy it. */
const PROMPT_IN_README = `${GITHUB_URL}#build-it-into-your-agent-app`;

/**
 * A card with one button that copies the build prompt: the text a developer
 * pastes into their own coding agent to build these flows into their app.
 * Same shell and 40px button as the controls card, and it enters with them.
 */
export function CopyPromptButton({
  animate = false,
  className,
}: {
  animate?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(BUILD_PROMPT);
      setCopied(true);
    } catch {
      // No clipboard (an insecure origin, or permission refused): show the prompt instead.
      window.open(PROMPT_IN_README, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-[10px] border border-border bg-background/80 p-1.5 backdrop-blur",
        animate && "enter-down enter-down-far",
        className,
      )}
      style={animate ? { animationDelay: `${HEADER_ENTER_DELAY_MS}ms` } : undefined}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy prompt to build this"}
            className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-[0px_1px_2px_rgba(0,0,0,0.05)] transition-shadow outline-none hover:shadow-[0px_2px_6px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-ring lg:px-3"
          >
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            {/* Below lg the header row beside it leaves room for the icon only. */}
            <span className="hidden lg:inline">
              {copied ? "Copied" : "Copy prompt to build this"}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Paste it into Claude Code, Cursor or Codex in your own app</TooltipContent>
      </Tooltip>
      <span aria-live="polite" className="sr-only">
        {copied ? "Prompt copied" : ""}
      </span>
    </div>
  );
}
