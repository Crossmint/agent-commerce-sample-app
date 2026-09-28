"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@agent-commerce/ui";
import { AgentAvatar } from "@/components/brand";
import type {
  ApprovalOutcome,
  CheckoutOutcome,
  ProtectedInputOutcome,
  SavedCardOutcome,
} from "@/lib/chat/tools";
import type { ChatMessage, ChatMessagePart } from "@/lib/chat/types";
import { AgentCardApproval } from "./agent-card-approval";
import { PasswordRequest } from "./password-request";
import { AddCard } from "./add-card";
import { AttachmentPreview } from "./attachment-preview";
import { WatchRun } from "./checkout-card";
import { CheckoutSiteLine } from "./checkout-site";
import { ProductCards } from "./product-cards";
import { Receipt } from "@/components/receipt";
import { ActivityLine } from "./activity-line";
import {
  checkoutOf,
  checkoutSiteOf,
  checkoutStatusLine,
  findPaymentStep,
  productsMessageOf,
  productsOf,
  receiptMessageOf,
  receiptOf,
  isToolError,
  isCheckoutPart,
  messageText,
  passwordRequestOf,
  toolBusy,
  toolTitle,
  watchedHere,
  type ToolState,
  type WatchIndex,
} from "./parts";
import { AgentBubble, ENTER, ENTER_SENT } from "./text";

export interface MessageProps {
  message: ChatMessage;
  /** True while this message is still streaming in. */
  streaming: boolean;
  onApprovalOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
  onPasswordOutcome: (toolCallId: string, outcome: ProtectedInputOutcome) => void;
  onCardSaved: (toolCallId: string, outcome: SavedCardOutcome) => void;
  onCheckoutOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  /** The thread's watched checkouts, from `watchIndex`. */
  watches: WatchIndex;
  /** Send a message as the user: what a tap on a product card does. */
  onSend: (text: string) => void;
}

/**
 * One turn in the desktop chat. The user speaks in a grey bubble on the
 * right; the agent answers beside its avatar with plain text and tool cards.
 */
export function Message({
  message,
  streaming,
  onApprovalOutcome,
  onPasswordOutcome,
  onCardSaved,
  onCheckoutOutcome,
  watches,
  onSend,
}: MessageProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  if (message.role !== "assistant") return null;

  const hasContent = message.parts.some(
    (p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-") || p.type === "file",
  );

  return (
    <div className="flex items-start gap-3" data-role="assistant">
      <AgentAvatar size={32} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {!hasContent && streaming ? <Thinking /> : null}
        {message.parts.map((part, i) => (
          // Each part rises in as it arrives. A part that draws nothing leaves no gap.
          <div key={`${message.id}-${i}`} className={cn("flex flex-col gap-3 empty:hidden", ENTER)}>
            <Part
              message={message}
              part={part}
              streaming={streaming}
              onApprovalOutcome={onApprovalOutcome}
              onPasswordOutcome={onPasswordOutcome}
              onCardSaved={onCardSaved}
              onCheckoutOutcome={onCheckoutOutcome}
              watches={watches}
              onSend={onSend}
            />
          </div>
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
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${i * 120}ms` }}
        />
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
            <AttachmentPreview
              key={f.url}
              attachment={{ name: f.filename ?? "file", url: f.url, contentType: f.mediaType }}
            />
          ))}
        </div>
      ) : null}
      {text ? (
        <div
          className={cn(
            "max-w-[min(85%,42rem)] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-primary-foreground",
            ENTER_SENT,
          )}
        >
          {text}
        </div>
      ) : null}
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

function Part({
  message,
  part,
  streaming,
  onApprovalOutcome,
  onPasswordOutcome,
  onCardSaved,
  onCheckoutOutcome,
  watches,
  onSend,
}: {
  message: ChatMessage;
  part: ChatMessagePart;
  streaming: boolean;
  onApprovalOutcome: MessageProps["onApprovalOutcome"];
  onPasswordOutcome: MessageProps["onPasswordOutcome"];
  onCardSaved: MessageProps["onCardSaved"];
  onCheckoutOutcome: MessageProps["onCheckoutOutcome"];
  watches: WatchIndex;
  onSend: MessageProps["onSend"];
}) {
  switch (part.type) {
    case "text":
      return part.text.trim() ? <AgentBubble text={part.text} /> : null;

    case "file":
      return (
        <AttachmentPreview
          attachment={{ name: part.filename ?? "file", url: part.url, contentType: part.mediaType }}
        />
      );

    case "tool-await_agent_card_approval": {
      // A checkout waiting on this is the user choosing how to pay, not an
      // agent asking for a budget, so the agent asks that.
      const requestId = part.input?.requestId ?? "";
      const paying =
        watches.paymentRequests.has(requestId) || Boolean(findPaymentStep(message, requestId));
      if (part.state === "input-available" || part.state === "output-available") {
        return (
          <AgentCardApproval
            toolCallId={part.toolCallId}
            requestId={part.input.requestId}
            output={part.state === "output-available" ? part.output : undefined}
            paying={paying}
            onOutcome={onApprovalOutcome}
          />
        );
      }
      return (
        <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
          {toolTitle(part.type)}
        </ActivityLine>
      );
    }

    // Adding a card: Crossmint's card form in a dialog.
    case "tool-await_saved_card":
      if (part.state === "input-available" || part.state === "output-available") {
        return (
          <AddCard
            toolCallId={part.toolCallId}
            output={part.state === "output-available" ? part.output : undefined}
            onOutcome={onCardSaved}
          />
        );
      }
      return (
        <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
          {toolTitle(part.type)}
        </ActivityLine>
      );

    // The store asks for a password: Crossmint's field in a dialog, never words.
    case "tool-await_protected_input": {
      const request = passwordRequestOf(part, watches);
      if (request && (part.state === "input-available" || part.state === "output-available")) {
        return (
          <PasswordRequest
            toolCallId={part.toolCallId}
            checkoutId={request.checkoutId}
            requestId={request.requestId}
            domain={request.domain}
            output={part.state === "output-available" ? part.output : undefined}
            onOutcome={onPasswordOutcome}
          />
        );
      }
      return (
        <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
          {toolTitle(part.type)}
        </ActivityLine>
      );
    }

    // The store's agent speaks through the watch: each update is a line of
    // the agent's own, live while the run goes, from the output after.
    case "tool-watch_checkout":
      // Each call is one stretch of the checkout, as a card of steps.
      if (part.state === "input-available" || part.state === "output-available") {
        return (
          <WatchRun
            toolCallId={part.toolCallId}
            checkoutId={part.input.checkoutId}
            watches={watches}
            output={part.state === "output-available" ? part.output : undefined}
            onOutcome={onCheckoutOutcome}
          />
        );
      }
      return part.state === "output-error" ? (
        <ActivityLine failed>{toolTitle(part.type)}</ActivityLine>
      ) : null;

    default:
      if (isCheckoutPart(part)) {
        // Starting a checkout says, once, which site the agent went to.
        const site = checkoutSiteOf(part);
        const failed =
          part.state === "output-error" ||
          (part.state === "output-available" && isToolError(part.output));
        if (site && !failed) {
          // The steps card names the site once the run is followed; until then, a line.
          if (site.checkoutId && watches.firstWatch.has(site.checkoutId)) return null;
          return <CheckoutSiteLine site={site} className="-mb-1.5 pl-1" />;
        }
        if (watchedHere(message, part)) return null;
        // Anything else a checkout call did: one line, as the phone draws it.
        const view = checkoutOf(part);
        return (
          <ActivityLine
            busy={toolBusy(part.state)}
            failed={part.state === "output-error" || Boolean(view?.failure)}
          >
            {view ? checkoutStatusLine(view) : toolTitle(part.type)}
          </ActivityLine>
        );
      }
      {
        // What a search or a look-up found, as cards with pictures, under the
        // line the agent put on the call.
        const message = productsMessageOf(part);
        const products = productsOf(part);
        if (message || products?.length) {
          return (
            <>
              {message ? <AgentBubble text={message} /> : null}
              {products?.length ? <ProductCards products={products} onPick={onSend} /> : null}
            </>
          );
        }
      }
      {
        // A checkout that went through: the receipt, under the agent's line on it.
        const message = receiptMessageOf(part);
        const receipt = receiptOf(part);
        if (message || receipt) {
          return (
            <>
              {message ? <AgentBubble text={message} /> : null}
              {receipt ? <Receipt receipt={receipt} className="max-w-[300px]" /> : null}
            </>
          );
        }
      }
      // Any other tool call: one line, as the phone draws it.
      if (part.type.startsWith("tool-")) {
        const tool = part as Extract<ChatMessagePart, { type: `tool-${string}`; state: ToolState }>;
        const failed =
          tool.state === "output-error" ||
          (tool.state === "output-available" &&
            Boolean((tool.output as { error?: unknown } | undefined)?.error));
        return (
          <ActivityLine busy={toolBusy(tool.state)} failed={failed}>
            {toolTitle(tool.type)}
          </ActivityLine>
        );
      }
      // reasoning, step-start, sources, data parts: nothing to draw.
      void streaming;
      return null;
  }
}

export type { ToolState };
