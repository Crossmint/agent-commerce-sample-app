"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatStatus,
} from "ai";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import type { Attachment, ChatMessage } from "@/lib/chat/types";

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
 * - `onApprovalOutcome` is what an approval screen calls when the user answers.
 *
 * With persistence on, the first message of a new chat writes `?chat=<id>`
 * into the URL so a reload finds the history, and each finished turn asks the
 * server for a fresh chat list.
 */
export function useAgentChat({ id, initialMessages, persist }: UseAgentChatOptions): AgentChat {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, stop, addToolOutput } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (e) => setError(e.message || "Something went wrong."),
    onFinish: () => {
      if (persist) router.refresh();
    },
  });

  const urlSet = useRef(initialMessages.length > 0);
  const send = useCallback(
    (text: string, attachments: Attachment[] = []) => {
      setError(null);
      if (persist && !urlSet.current) {
        urlSet.current = true;
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
      void addToolOutput({ tool: "await_agent_card_approval", toolCallId, output });
    },
    [addToolOutput],
  );

  return {
    messages,
    status,
    busy: status === "submitted" || status === "streaming",
    send,
    stop: () => void stop(),
    onApprovalOutcome,
    error,
    dismissError: () => setError(null),
    reportError: setError,
  };
}

/** The three openers a new chat offers. */
export const SUGGESTIONS = ["Buy this for me: https://", "Give me a $50 card for lunch this week"];
