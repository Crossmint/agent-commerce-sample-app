"use client";

import { useMemo } from "react";
import { ArrowDown } from "lucide-react";
import type { ChatStatus } from "ai";
import { cn } from "@agent-commerce/ui";
import { AgentAvatar } from "@/components/brand";
import type { ApprovalOutcome, CheckoutOutcome } from "@/lib/chat/tools";
import type { ChatMessage } from "@/lib/chat/types";
import { Greeting } from "./greeting";
import { Message, Thinking } from "./message";
import { watchIndex } from "./parts";
import { useScrollToBottom } from "./use-scroll-to-bottom";

export interface MessagesProps {
  messages: ChatMessage[];
  status: ChatStatus;
  onApprovalOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
  onCheckoutOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  suggestions: string[];
  onPickSuggestion: (text: string) => void;
}

/** The desktop transcript: a centered column that follows the newest message. */
export function Messages({ messages, status, onApprovalOutcome, onCheckoutOutcome, suggestions, onPickSuggestion }: MessagesProps) {
  const { containerRef, isAtBottom, scrollToBottom } = useScrollToBottom();
  const last = messages.at(-1);
  const waiting = status === "submitted" && last?.role !== "assistant";
  const watches = useMemo(() => watchIndex(messages), [messages]);

  if (messages.length === 0) {
    return <Greeting suggestions={suggestions} onPick={onPickSuggestion} />;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.map((m, i) => (
            <div key={m.id} className="group/message">
              <Message message={m} streaming={status === "streaming" && i === messages.length - 1} onApprovalOutcome={onApprovalOutcome} onCheckoutOutcome={onCheckoutOutcome} watches={watches} />
            </div>
          ))}
          {waiting ? (
            <div className="flex items-start gap-3">
              <AgentAvatar size={32} className="mt-0.5" />
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
          "absolute bottom-3 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-card text-muted-foreground shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-foreground/10 transition-all hover:text-foreground",
          isAtBottom ? "pointer-events-none scale-90 opacity-0" : "opacity-100",
        )}
      >
        <ArrowDown className="size-4" />
      </button>
    </div>
  );
}
