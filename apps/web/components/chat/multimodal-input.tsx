"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import type { ChatStatus } from "ai";
import { Button, cn } from "@goat-wallet/ui";
import type { Attachment } from "@/lib/chat/types";
import { AttachmentPreview } from "./attachment-preview";
import { Textarea } from "./textarea";

export interface MultimodalInputProps {
  status: ChatStatus;
  attachmentsEnabled: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  onError: (message: string) => void;
  className?: string;
}

/**
 * Textarea plus attachments. Enter sends, Shift+Enter breaks the line.
 * Files go to /api/files/upload first; the message carries their URLs.
 */
export function MultimodalInput({ status, attachmentsEnabled, onSend, onStop, onError, className }: MultimodalInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = status === "submitted" || status === "streaming";
  const canSend = !busy && uploading.length === 0 && (text.trim().length > 0 || attachments.length > 0);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    textareaRef.current?.focus();
  }, [attachments, canSend, onSend, text]);

  const upload = useCallback(
    async (files: File[]) => {
      if (!attachmentsEnabled || files.length === 0) return;
      setUploading((q) => [...q, ...files.map((f) => f.name)]);
      try {
        const results = await Promise.all(
          files.map(async (file) => {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/files/upload", { method: "POST", body: form });
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
              onError(body?.error?.message ?? `Upload failed for ${file.name}.`);
              return null;
            }
            return (await res.json()) as Attachment;
          }),
        );
        setAttachments((prev) => [...prev, ...results.filter((r): r is Attachment => r !== null)]);
      } finally {
        setUploading((q) => q.filter((n) => !files.some((f) => f.name === n)));
      }
    },
    [attachmentsEnabled, onError],
  );

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    void upload(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (busy) return;
      submit();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!attachmentsEnabled) return;
    const files = Array.from(e.clipboardData.items)
      .filter((i) => i.kind === "file")
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length) {
      e.preventDefault();
      void upload(files);
    }
  }

  return (
    <form
      className={cn("rounded-md border border-border bg-card shadow-sm transition-colors focus-within:border-ring/60", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 || uploading.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3">
          {attachments.map((a) => (
            <AttachmentPreview key={a.url} attachment={a} onRemove={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))} />
          ))}
          {uploading.map((name) => (
            <AttachmentPreview key={`up-${name}`} attachment={{ name, url: "", contentType: "" }} uploading />
          ))}
        </div>
      ) : null}
      <Textarea
        ref={textareaRef}
        value={text}
        rows={1}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder="Ask GOAT to buy something…"
        aria-label="Message"
        className="min-h-12 border-0 bg-transparent px-4 pt-3 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div>
          {attachmentsEnabled ? (
            <>
              <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onFiles} tabIndex={-1} />
              <Button type="button" variant="ghost" size="icon" aria-label="Attach a file" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                <Paperclip />
              </Button>
            </>
          ) : null}
        </div>
        {busy ? (
          <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={onStop}>
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!canSend}>
            <ArrowUp />
          </Button>
        )}
      </div>
    </form>
  );
}
