"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@goat-wallet/ui";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import type { Attachment, ChatMessage } from "@/lib/chat/types";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

export interface ChatProps {
  id: string;
  initialMessages: ChatMessage[];
  /** True when DATABASE_URL is set: the URL moves to /chat/<id> and history refreshes. */
  persist: boolean;
  attachmentsEnabled: boolean;
}

const SUGGESTIONS = [
  "What agent cards do I have?",
  "Set up a $50 budget for lunch this week",
  "Buy this for me: https://",
];

/**
 * One chat. `useChat` owns the messages; this component wires the pieces:
 * - the transport posts the whole conversation to /api/chat,
 * - `sendAutomaticallyWhen` resubmits once every tool call in the last
 *   assistant message has an output, which is how the client-side
 *   `await_agent_card_approval` tool hands control back to the model,
 * - `addToolOutput` is what the inline approval card calls when the user answers.
 */
export function Chat({ id, initialMessages, persist, attachmentsEnabled }: ChatProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, boolean>>({});

  const { messages, sendMessage, status, stop, addToolOutput } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (e) => setError(e.message || "Something went wrong."),
    onFinish: () => {
      if (persist) router.refresh();
    },
  });

  // First message in a new chat: keep the id in the URL so a reload finds the history.
  const urlSet = useRef(initialMessages.length > 0);
  const send = useCallback(
    (text: string, attachments: Attachment[]) => {
      setError(null);
      if (persist && !urlSet.current) {
        urlSet.current = true;
        window.history.replaceState(null, "", `/chat/${encodeURIComponent(id)}`);
      }
      void sendMessage({
        role: "user",
        parts: [
          ...attachments.map((a) => ({ type: "file" as const, url: a.url, mediaType: a.contentType, filename: a.name })),
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

  // Votes: only with a database, only once there is something to vote on.
  useEffect(() => {
    if (!persist || initialMessages.length < 2) return;
    let cancelled = false;
    fetch(`/api/chat/vote?chatId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { votes?: Array<{ messageId: string; isUpvoted: boolean }> } | null) => {
        if (cancelled || !body?.votes) return;
        setVotes(Object.fromEntries(body.votes.map((v) => [v.messageId, v.isUpvoted])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, persist, initialMessages.length]);

  const onVote = useCallback(
    (messageId: string, isUpvoted: boolean) => {
      setVotes((v) => ({ ...v, [messageId]: isUpvoted }));
      void fetch("/api/chat/vote", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: id, messageId, isUpvoted }),
      });
    },
    [id],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Messages
        messages={messages}
        status={status}
        onApprovalOutcome={onApprovalOutcome}
        votes={persist ? votes : undefined}
        onVote={persist ? onVote : undefined}
        suggestions={SUGGESTIONS}
        onPickSuggestion={(text) => send(text, [])}
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
        {error ? (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertTitle>That did not work</AlertTitle>
            <AlertDescription className="w-full">
              <div className="flex w-full items-start justify-between gap-3">
                <p>{error}</p>
                <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Dismiss" onClick={() => setError(null)}>
                  <X />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        <MultimodalInput status={status} attachmentsEnabled={attachmentsEnabled} onSend={send} onStop={() => void stop()} onError={setError} />
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          GOAT asks before it spends. Your card number never reaches the agent or the store.
        </p>
      </div>
    </div>
  );
}
