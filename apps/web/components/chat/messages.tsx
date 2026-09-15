"use client";

import { ArrowDown } from "lucide-react";
import type { ChatStatus } from "ai";
import { Mascot, cn } from "@goat-wallet/ui";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import type { ChatMessage } from "@/lib/chat/types";
import { Greeting } from "./greeting";
import { Message, Thinking } from "./message";
import { useScrollToBottom } from "./use-scroll-to-bottom";

export interface MessagesProps {
  messages: ChatMessage[];
  status: ChatStatus;
  onApprovalOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
  votes?: Record<string, boolean>;
  onVote?: (messageId: string, isUpvoted: boolean) => void;
  suggestions: string[];
  onPickSuggestion: (text: string) => void;
}

export function Messages({ messages, status, onApprovalOutcome, votes, onVote, suggestions, onPickSuggestion }: MessagesProps) {
  const { containerRef, isAtBottom, scrollToBottom } = useScrollToBottom();
  const last = messages.at(-1);
  const waiting = status === "submitted" && last?.role !== "assistant";

  if (messages.length === 0) {
    return <Greeting suggestions={suggestions} onPick={onPickSuggestion} />;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.map((m, i) => (
            <div key={m.id} className="group/message">
              <Message
                message={m}
                streaming={status === "streaming" && i === messages.length - 1}
                onApprovalOutcome={onApprovalOutcome}
                vote={votes?.[m.id]}
                onVote={onVote}
              />
            </div>
          ))}
          {waiting ? (
            <div className="flex items-start gap-3">
              <Mascot size={32} className="mt-0.5 shrink-0" />
              <Thinking />
            </div>
          ) : null}
          <div className="h-2 shrink-0" />
        </div>
      </div>
      <button
        type="button"
        aria-label="Scroll to bottom"
        onClick={() => scrollToBottom("smooth")}
        className={cn(
          "absolute bottom-3 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all hover:text-foreground",
          isAtBottom ? "pointer-events-none scale-90 opacity-0" : "opacity-100",
        )}
      >
        <ArrowDown className="size-4" />
      </button>
    </div>
  );
}
