"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { CheckoutView } from "@agent-commerce/server";
import { AgentAvatar } from "@/components/brand";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import type { ChatMessage, ChatMessagePart } from "@/lib/chat/types";
import { AgentCardApproval, AgentCardRequestCard } from "./agent-card-approval";
import { AttachmentPreview } from "./attachment-preview";
import { CheckoutCard } from "./checkout-card";
import { CHECKOUT_TITLES, isCheckoutPart, messageText, toolSummary, toolTitle, type RequestSummary, type ToolError } from "./parts";
import { Text } from "./text";
import { ToolCard, type ToolState } from "./tool-card";

export interface MessageProps {
  message: ChatMessage;
  /** True while this message is still streaming in. */
  streaming: boolean;
  onApprovalOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
}

/**
 * One turn in the desktop chat. The user speaks in a grey bubble on the
 * right; the agent answers beside its avatar with plain text and tool cards.
 */
export function Message({ message, streaming, onApprovalOutcome }: MessageProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  if (message.role !== "assistant") return null;

  const hasContent = message.parts.some((p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-") || p.type === "file");

  return (
    <div className="flex items-start gap-3" data-role="assistant">
      <AgentAvatar size={32} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {!hasContent && streaming ? <Thinking /> : null}
        {message.parts.map((part, i) => (
          <Part key={`${message.id}-${i}`} part={part} streaming={streaming} onApprovalOutcome={onApprovalOutcome} />
        ))}
        {!streaming && hasContent ? <CopyAction message={message} /> : null}
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
  const text = messageText(message);
  return (
    <div className="flex flex-col items-end gap-2" data-role="user">
      {files.length ? (
        <div className="flex flex-wrap justify-end gap-2">
          {files.map((f) => (
            <AttachmentPreview key={f.url} attachment={{ name: f.filename ?? "file", url: f.url, contentType: f.mediaType }} />
          ))}
        </div>
      ) : null}
      {text ? <div className="max-w-[min(85%,42rem)] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-foreground">{text}</div> : null}
    </div>
  );
}

function CopyAction({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const text = messageText(message);
  if (!text) return null;
  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/message:opacity-100">
      <button
        type="button"
        aria-label="Copy"
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function Part({ part, streaming, onApprovalOutcome }: { part: ChatMessagePart; streaming: boolean; onApprovalOutcome: MessageProps["onApprovalOutcome"] }) {
  switch (part.type) {
    case "text":
      return part.text.trim() ? <Text text={part.text} /> : null;

    case "file":
      return <AttachmentPreview attachment={{ name: part.filename ?? "file", url: part.url, contentType: part.mediaType }} />;

    case "tool-request_agent_card":
      return (
        <AgentCardRequestCard
          state={part.state}
          input={part.input}
          output={part.state === "output-available" ? (part.output as RequestSummary | ToolError) : undefined}
          errorText={part.state === "output-error" ? part.errorText : undefined}
        />
      );

    case "tool-await_agent_card_approval": {
      if (part.state === "input-available") {
        return <AgentCardApproval toolCallId={part.toolCallId} requestId={part.input.requestId} onOutcome={onApprovalOutcome} />;
      }
      if (part.state === "output-available") {
        return <AgentCardApproval toolCallId={part.toolCallId} requestId={part.input.requestId} output={part.output} onOutcome={onApprovalOutcome} />;
      }
      return <ToolCard title="Waiting for your approval" state={part.state} errorText={part.state === "output-error" ? part.errorText : undefined} />;
    }

    default:
      if (isCheckoutPart(part)) {
        return (
          <CheckoutCard
            title={CHECKOUT_TITLES[part.type]}
            state={part.state}
            input={part.input}
            checkout={part.state === "output-available" ? (part.output as CheckoutView | ToolError) : undefined}
            errorText={part.state === "output-error" ? part.errorText : undefined}
          />
        );
      }
      if (part.type.startsWith("tool-")) {
        const tool = part as Extract<ChatMessagePart, { type: `tool-${string}`; state: ToolState }>;
        return (
          <ToolCard
            title={toolTitle(tool.type)}
            state={tool.state}
            input={tool.input}
            output={tool.state === "output-available" ? tool.output : undefined}
            errorText={tool.state === "output-error" ? tool.errorText : undefined}
            summary={tool.state === "output-available" ? toolSummary(tool.type, tool.output) : undefined}
          />
        );
      }
      // reasoning, step-start, sources, data parts: nothing to draw.
      void streaming;
      return null;
  }
}

export type { ToolState };
