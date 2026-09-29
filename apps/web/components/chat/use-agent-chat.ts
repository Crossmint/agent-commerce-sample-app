"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatStatus,
} from "ai";
import type {
  ApprovalOutcome,
  BuyerDetailsOutcome,
  CheckoutOutcome,
  PaymentChoiceOutcome,
  ProtectedInputOutcome,
  SavedCardOutcome,
} from "@/lib/chat/tools";
import type { Attachment, ChatMessage } from "@/lib/chat/types";
import { useChatSounds } from "./use-chat-sounds";

export interface UseAgentChatOptions {
  id: string;
  initialMessages: ChatMessage[];
  /** True when DATABASE_URL is set: the id goes into the URL and the history list refreshes. */
  persist: boolean;
}

export interface AgentChat {
  messages: ChatMessage[];
  status: ChatStatus;
  /** True while a turn is in flight. */
  busy: boolean;
  send: (text: string, attachments?: Attachment[]) => void;
  stop: () => void;
  /** Hand the approval screen's answer back to the `await_agent_card_approval` tool call. */
  onApprovalOutcome: (toolCallId: string, outcome: ApprovalOutcome) => void;
  /** Hand the card form's result (saved or cancelled) back to the `await_saved_card` tool call. */
  onCardSaved: (toolCallId: string, outcome: SavedCardOutcome) => void;
  /** Hand the password field's answer (submitted or declined) back to the `await_protected_input` tool call. */
  onPasswordOutcome: (toolCallId: string, outcome: ProtectedInputOutcome) => void;
  /** Hand the details form's result (saved or skipped) back to the `await_buyer_details` tool call. */
  onBuyerDetails: (toolCallId: string, outcome: BuyerDetailsOutcome) => void;
  /** Hand the way the user chose to pay back to the `await_payment_choice` tool call. */
  onPaymentChoice: (toolCallId: string, outcome: PaymentChoiceOutcome) => void;
  /** Hand a watched checkout's question or ending back to the `watch_checkout` tool call. Once per call. */
  onCheckoutOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  error: string | null;
  dismissError: () => void;
  /** Show an error that came from outside the model turn, such as a failed upload. */
  reportError: (message: string) => void;
}

/**
 * One chat, without a face. `useChat` owns the messages; this hook wires the
 * pieces every frame needs the same way:
 * - the transport posts the whole conversation to /api/chat,
 * - `sendAutomaticallyWhen` resubmits once every tool call in the last
 *   assistant message has an output, which is how the client-side
 *   `await_agent_card_approval` tool hands control back to the model,
 * - `onApprovalOutcome` is what an approval screen calls when the user answers,
 * - `onCheckoutOutcome` is what a watched checkout calls when the store asks
 *   something, the run reaches its payment step, or it ends.
 *
 * With persistence on, the first message of a new chat writes `?chat=<id>`
 * into the URL so a reload finds the history, and each finished turn asks the
 * server for a fresh chat list.
 */
export function useAgentChat({ id, initialMessages, persist }: UseAgentChatOptions): AgentChat {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const {
    messages: raw,
    sendMessage,
    status,
    stop,
    addToolOutput,
    setMessages,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (e) => setError(e.message || "Something went wrong."),
    onFinish: () => {
      if (persist) router.refresh();
    },
  });

  /*
   * One hook for every conversation, so the frame around it stays mounted
   * when the user opens another chat. `useChat` starts a new chat when the id
   * changes; what belongs to the old one is dropped here. A saved chat's
   * history arrives after it opens, and lands as its messages while nothing
   * has been said in it yet.
   */
  const [chatId, setChatId] = useState(id);
  if (chatId !== id) {
    setChatId(id);
    setError(null);
  }
  useEffect(() => {
    if (initialMessages.length) setMessages((now) => (now.length ? now : initialMessages));
  }, [initialMessages, setMessages]);

  // One message per id, whatever the stream did: two copies would share a
  // React key and draw the turn twice.
  const messages = useMemo(() => uniqueById(raw), [raw]);

  useChatSounds(id, messages, status === "submitted" || status === "streaming");

  /*
   * Tool outputs wait for the turn to finish. A watch starts as soon as its
   * call streams in, and a store that asks at once would otherwise hand back
   * while the model is still talking: the SDK would send the follow-up in the
   * middle of that turn, and the two responses would both continue the same
   * message. Queued here, they go out one by one once the chat is idle.
   */
  type Output = { chatId: string; toolCallId: string } & (
    | { tool: "await_agent_card_approval"; output: ApprovalOutcome }
    | { tool: "await_protected_input"; output: ProtectedInputOutcome }
    | { tool: "await_saved_card"; output: SavedCardOutcome }
    | { tool: "await_buyer_details"; output: BuyerDetailsOutcome }
    | { tool: "await_payment_choice"; output: PaymentChoiceOutcome }
    | { tool: "watch_checkout"; output: CheckoutOutcome }
  );
  const queue = useRef<Output[]>([]);
  const [queued, setQueued] = useState(0);
  const idle = status === "ready" || status === "error";
  useEffect(() => {
    // Outputs for a chat that is no longer open go with it.
    queue.current = queue.current.filter((o) => o.chatId === id);
    if (!idle || !queue.current.length) return;
    const { chatId, ...next } = queue.current.shift()!;
    void chatId; // for the queue only
    setQueued(queue.current.length);
    void addToolOutput(next);
  }, [id, idle, queued, addToolOutput]);
  const hand = useCallback(
    (out: Omit<Output, "chatId">) => {
      queue.current.push({ ...out, chatId: id } as Output);
      setQueued(queue.current.length);
    },
    [id],
  );

  // The chat whose id is in the URL. A saved chat is there already: opening it put it there.
  const inUrl = useRef(initialMessages.length > 0 ? id : null);
  const send = useCallback(
    (text: string, attachments: Attachment[] = []) => {
      setError(null);
      if (persist && inUrl.current !== id) {
        inUrl.current = id;
        // Keep the frame in the URL; only the chat changes.
        const url = new URL(window.location.href);
        url.searchParams.set("chat", id);
        window.history.replaceState(null, "", url);
      }
      void sendMessage({
        role: "user",
        parts: [
          ...attachments.map((a) => ({
            type: "file" as const,
            url: a.url,
            mediaType: a.contentType,
            filename: a.name,
          })),
          ...(text ? [{ type: "text" as const, text }] : []),
        ],
      });
    },
    [id, persist, sendMessage],
  );

  const onApprovalOutcome = useCallback(
    (toolCallId: string, output: ApprovalOutcome) => {
      hand({ tool: "await_agent_card_approval", toolCallId, output });
    },
    [hand],
  );

  const onCardSaved = useCallback(
    (toolCallId: string, output: SavedCardOutcome) => {
      hand({ tool: "await_saved_card", toolCallId, output });
    },
    [hand],
  );

  const onPasswordOutcome = useCallback(
    (toolCallId: string, output: ProtectedInputOutcome) => {
      hand({ tool: "await_protected_input", toolCallId, output });
    },
    [hand],
  );

  // One answer per question: a sheet and a card can both hand one back.
  const answered = useRef(new Set<string>());
  const onBuyerDetails = useCallback(
    (toolCallId: string, output: BuyerDetailsOutcome) => {
      if (answered.current.has(toolCallId)) return;
      answered.current.add(toolCallId);
      hand({ tool: "await_buyer_details", toolCallId, output });
    },
    [hand],
  );

  const onPaymentChoice = useCallback(
    (toolCallId: string, output: PaymentChoiceOutcome) => {
      if (answered.current.has(toolCallId)) return;
      answered.current.add(toolCallId);
      hand({ tool: "await_payment_choice", toolCallId, output });
    },
    [hand],
  );

  // A run can end in front of more than one watcher (a card and a sheet), and
  // a watcher can remount. The model hears about each ending once.
  const reported = useRef(new Set<string>());
  const onCheckoutOutcome = useCallback(
    (toolCallId: string, output: CheckoutOutcome) => {
      if (reported.current.has(toolCallId)) return;
      reported.current.add(toolCallId);
      hand({ tool: "watch_checkout", toolCallId, output });
    },
    [hand],
  );

  return {
    messages,
    status,
    busy: status === "submitted" || status === "streaming",
    send,
    stop: () => void stop(),
    onApprovalOutcome,
    onPasswordOutcome,
    onCardSaved,
    onBuyerDetails,
    onPaymentChoice,
    onCheckoutOutcome,
    error,
    dismissError: () => setError(null),
    reportError: setError,
  };
}

/** The thread with one message per id, each at its first place and in its newest form. */
function uniqueById(messages: ChatMessage[]): ChatMessage[] {
  const latest = new Map<string, ChatMessage>();
  for (const m of messages) latest.set(m.id, m);
  if (latest.size === messages.length) return messages;
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(latest.get(m.id)!);
  }
  return out;
}
