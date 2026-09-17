"use client";

import { useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { Mascot, cn } from "@goat-wallet/ui";
import type { CheckoutView } from "@goat-wallet/server";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import type { ChatMessage, ChatMessagePart } from "@/lib/chat/types";
import { AgentCardApproval, AgentCardRequestCard, type RequestSummary } from "./agent-card-approval";
import { AttachmentPreview } from "./attachment-preview";
import { CheckoutCard } from "./checkout-card";
import { Text } from "./text";
import { ToolCard, humanizeToolName, type ToolState } from "./tool-card";

export interface MessageProps {
  message: ChatMessage;
  /** True while this message is still streaming in. */
  streaming: boolean;
  onApprovalOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
  /** Present only when history is on. */
  vote?: boolean;
  onVote?: (messageId: string, isUpvoted: boolean) => void;
}

export function Message({ message, streaming, onApprovalOutcome, vote, onVote }: MessageProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  if (message.role !== "assistant") return null;

  const hasContent = message.parts.some(
    (p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-") || p.type === "file",
  );

  return (
    <div className="flex items-start gap-3" data-role="assistant">
      <Mascot size={32} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {!hasContent && streaming ? <Thinking /> : null}
        {message.parts.map((part, i) => (
          <Part key={`${message.id}-${i}`} part={part} message={message} streaming={streaming} onApprovalOutcome={onApprovalOutcome} />
        ))}
        {!streaming && hasContent ? <Actions message={message} vote={vote} onVote={onVote} /> : null}
      </div>
    </div>
  );
}

export function Thinking() {
  return (
    <div className="flex h-8 items-center gap-1.5 text-muted-foreground" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  const files = message.parts.filter((p) => p.type === "file");
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
  return (
    <div className="flex flex-col items-end gap-2" data-role="user">
      {files.length ? (
        <div className="flex flex-wrap justify-end gap-2">
          {files.map((f) => (
            <AttachmentPreview key={f.url} attachment={{ name: f.filename ?? "file", url: f.url, contentType: f.mediaType }} />
          ))}
        </div>
      ) : null}
      {text ? (
        <div className="max-w-[min(85%,42rem)] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed text-secondary-foreground">
          {text}
        </div>
      ) : null}
    </div>
  );
}

function Actions({ message, vote, onVote }: { message: ChatMessage; vote?: boolean; onVote?: MessageProps["onVote"] }) {
  const [copied, setCopied] = useState(false);
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
  if (!text && !onVote) return null;
  const btn = "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100">
      {text ? (
        <button
          type="button"
          aria-label="Copy"
          className={btn}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      ) : null}
      {onVote ? (
        <>
          <button type="button" aria-label="Good response" aria-pressed={vote === true} className={cn(btn, vote === true && "text-success")} onClick={() => onVote(message.id, true)}>
            <ThumbsUp className="size-3.5" />
          </button>
          <button type="button" aria-label="Bad response" aria-pressed={vote === false} className={cn(btn, vote === false && "text-destructive")} onClick={() => onVote(message.id, false)}>
            <ThumbsDown className="size-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function Part({
  part,
  message,
  streaming,
  onApprovalOutcome,
}: {
  part: ChatMessagePart;
  message: ChatMessage;
  streaming: boolean;
  onApprovalOutcome: MessageProps["onApprovalOutcome"];
}) {
  switch (part.type) {
    case "text":
      return part.text.trim() ? <Text text={part.text} /> : null;

    case "file":
      return <AttachmentPreview attachment={{ name: part.filename ?? "file", url: part.url, contentType: part.mediaType }} />;

    case "tool-request_agent_card": {
      const output = part.state === "output-available" ? (part.output as RequestSummary | { error: string; code: string }) : undefined;
      const requestId = output && !("error" in output) ? output.requestId : undefined;
      const awaited = requestId
        ? message.parts.some((p) => p.type === "tool-await_agent_card_approval" && p.input?.requestId === requestId)
        : false;
      return (
        <AgentCardRequestCard
          state={part.state}
          input={part.input}
          output={output}
          errorText={part.state === "output-error" ? part.errorText : undefined}
          showApprovalLink={Boolean(requestId) && !awaited && !streaming}
        />
      );
    }

    case "tool-await_agent_card_approval": {
      if (part.state === "input-available") {
        return <AgentCardApproval toolCallId={part.toolCallId} requestId={part.input.requestId} onOutcome={onApprovalOutcome} />;
      }
      if (part.state === "output-available") {
        return <AgentCardApproval toolCallId={part.toolCallId} requestId={part.input.requestId} output={part.output} onOutcome={onApprovalOutcome} />;
      }
      return (
        <ToolCard
          title="Waiting for your approval"
          state={part.state}
          errorText={part.state === "output-error" ? part.errorText : undefined}
        />
      );
    }

    case "tool-create_checkout":
    case "tool-get_checkout":
    case "tool-answer_checkout":
    case "tool-cancel_checkout": {
      const titles = {
        "tool-create_checkout": "Starting a checkout",
        "tool-get_checkout": "Checking the checkout",
        "tool-answer_checkout": "Answering the checkout",
        "tool-cancel_checkout": "Cancelling the checkout",
      } as const;
      return (
        <CheckoutCard
          title={titles[part.type]}
          state={part.state}
          input={part.input}
          checkout={part.state === "output-available" ? (part.output as CheckoutView | { error: string; code: string }) : undefined}
          errorText={part.state === "output-error" ? part.errorText : undefined}
        />
      );
    }

    case "tool-list_payment_methods":
    case "tool-list_agent_cards":
    case "tool-get_agent_card":
    case "tool-reveal_agent_card":
      return (
        <ToolCard
          title={toolTitle(part.type)}
          state={part.state}
          input={part.input}
          output={part.state === "output-available" ? part.output : undefined}
          errorText={part.state === "output-error" ? part.errorText : undefined}
          summary={part.state === "output-available" ? summarize(part.type, part.output) : undefined}
        />
      );

    default:
      // reasoning, step-start, sources, data parts: nothing to draw.
      return null;
  }
}

function toolTitle(type: string): string {
  const titles: Record<string, string> = {
    "tool-list_payment_methods": "Looking at your saved cards",
    "tool-list_agent_cards": "Looking at your agent cards",
    "tool-get_agent_card": "Checking an agent card",
    "tool-reveal_agent_card": "Minting a card credential",
  };
  return titles[type] ?? humanizeToolName(type.replace(/^tool-/, ""));
}

function summarize(type: string, output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const o = output as Record<string, unknown>;
  if (typeof o.error === "string") return o.error;
  switch (type) {
    case "tool-list_payment_methods": {
      const n = Array.isArray(o.paymentMethods) ? o.paymentMethods.length : 0;
      return n === 1 ? "1 saved card" : `${n} saved cards`;
    }
    case "tool-list_agent_cards": {
      const n = Array.isArray(o.agentCards) ? o.agentCards.length : 0;
      return n === 1 ? "1 agent card" : `${n} agent cards`;
    }
    case "tool-get_agent_card":
      return typeof o.available === "string" && typeof o.currency === "string" ? `${o.available} ${o.currency} available` : undefined;
    case "tool-reveal_agent_card":
      return o.enforced === false ? "Limit not enforced on this rail" : `Minted on ${String(o.rail ?? "a rail")}. Number not shown here.`;
    default:
      return undefined;
  }
}

export type { ToolState };
