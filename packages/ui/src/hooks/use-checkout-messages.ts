"use client";

import * as React from "react";
import type { CheckoutMessage, CheckoutMessageList } from "@agent-commerce/core";
import { useAgentCommerce } from "../provider.js";
import type { Resource } from "./use-resource.js";

/** Pages a transcript may take before the history read stops following the cursor. */
const MAX_PAGES = 5;
/** Waits between reconnects, doubling from the first and never past the last. */
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 15_000;

/** Something the stream reported, for a caller that reacts to it. */
export type CheckoutStreamEvent =
  { type: "message"; message: CheckoutMessage } | { type: "run"; data: unknown };

export interface UseCheckoutMessagesOptions {
  /** Follow the stream while this is true, typically while the run is not terminal. Default true. */
  live?: boolean;
  /**
   * Each event as it lands. A `run` event means the run changed: read the
   * checkout again, which is also where the payment step is answered.
   */
  onEvent?: (event: CheckoutStreamEvent) => void;
}

/**
 * A checkout's transcript, oldest first: what the agent reported, what it
 * asked, what the user answered.
 *
 * Reads the history once, then follows Crossmint's event stream from the
 * cursor the history reports, so a new message shows the moment it is
 * written and nothing polls. When the stream closes (the host cuts long
 * requests, or a cursor went stale) it does what Crossmint advises: read the
 * history again and reconnect from the cursor that reports, waiting a little
 * longer each time it fails in a row.
 */
export function useCheckoutMessages(
  checkoutId: string | undefined,
  { live = true, onEvent }: UseCheckoutMessagesOptions = {},
): Resource<CheckoutMessage[]> {
  const { api } = useAgentCommerce();
  const [data, setData] = React.useState<CheckoutMessage[] | undefined>(undefined);
  const [error, setError] = React.useState<unknown>(undefined);
  const [loading, setLoading] = React.useState(Boolean(checkoutId));
  const [refreshing, setRefreshing] = React.useState(false);
  const cursor = React.useRef<string | undefined>(undefined);
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;
  const dataRef = React.useRef<CheckoutMessage[] | undefined>(undefined);
  // The first history read, which the stream waits for rather than reading again.
  const firstRead = React.useRef<Promise<unknown> | undefined>(undefined);

  const readHistory = React.useCallback(async () => {
    if (!checkoutId) return undefined;
    setRefreshing(true);
    try {
      const out: CheckoutMessage[] = [];
      let page: string | undefined;
      let last: CheckoutMessageList | undefined;
      for (let i = 0; i < MAX_PAGES; i++) {
        last = await api.listCheckoutMessages(checkoutId, { cursor: page, limit: 100 });
        out.push(...last.data);
        if (!last.nextCursor) break;
        page = last.nextCursor;
      }
      if (last?.streamCursor) cursor.current = last.streamCursor;
      dataRef.current = out;
      setData(out);
      setError(undefined);
      return out;
    } catch (e) {
      setError(e);
      return dataRef.current;
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [api, checkoutId]);

  // The history, whenever the checkout changes.
  React.useEffect(() => {
    cursor.current = undefined;
    dataRef.current = undefined;
    setData(undefined);
    setLoading(Boolean(checkoutId));
    firstRead.current = readHistory();
  }, [checkoutId, readHistory]);

  // Follow the stream while live.
  React.useEffect(() => {
    if (!live || !checkoutId) return;
    const abort = new AbortController();
    let failures = 0;

    const upsert = (message: CheckoutMessage) => {
      setData((prev) => {
        const list = prev ?? [];
        const at = list.findIndex((m) => m.id === message.id);
        const next = at === -1 ? [...list, message] : list.map((m, i) => (i === at ? message : m));
        dataRef.current = next;
        return next;
      });
    };

    void (async () => {
      while (!abort.signal.aborted) {
        try {
          await firstRead.current;
          if (!cursor.current) await readHistory();
          const res = await api.streamCheckoutMessages(checkoutId, {
            after: cursor.current,
            signal: abort.signal,
          });
          let events = 0;
          await readEvents(res, abort.signal, (event) => {
            events++;
            if (event.id) cursor.current = event.id;
            const payload = parse(event.data);
            if (event.event === "message.upsert") {
              const message = asMessage(payload);
              if (message) {
                upsert(message);
                onEventRef.current?.({ type: "message", message });
              }
            } else if (event.event === "run.updated") {
              onEventRef.current?.({ type: "run", data: payload });
            }
          });
          // A stream that closed with nothing in it counts as a failure, so
          // one that keeps closing at once is retried less and less often.
          failures = events > 0 ? 0 : failures + 1;
        } catch (e) {
          if (abort.signal.aborted) return;
          failures++;
          setError(e);
        }
        if (abort.signal.aborted) return;
        // Closed: catch up on what the gap held, then pick up from there.
        await sleep(
          Math.min(RETRY_MIN_MS * 2 ** Math.max(failures - 1, 0), RETRY_MAX_MS),
          abort.signal,
        );
        if (abort.signal.aborted) return;
        await readHistory();
      }
    })();

    return () => abort.abort();
  }, [live, checkoutId, api, readHistory]);

  // A run that just ended may have written its last lines after the stream closed.
  const wasLive = React.useRef(live);
  React.useEffect(() => {
    if (wasLive.current && !live) void readHistory();
    wasLive.current = live;
  }, [live, readHistory]);

  return { data, error, loading, refreshing, refetch: readHistory, setData };
}

/**
 * True when an event means the checkout itself changed and is worth reading
 * again: the run moved, or a message brought an open question.
 */
export function checkoutChanged(event: CheckoutStreamEvent): boolean {
  if (event.type === "run") return true;
  return event.message.parts.some(
    (p) => p.type === "input_request" && (p as { status?: string }).status === "open",
  );
}

/**
 * How often to read a checkout while its stream is followed: only a fallback,
 * for a stream that went quiet. The stream's events trigger the real reads.
 */
export const CHECKOUT_FALLBACK_POLL_MS = 10_000;

interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

/** Read a `text/event-stream` body to its end, one event at a time. */
async function readEvents(res: Response, signal: AbortSignal, onEvent: (event: SseEvent) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  const stop = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", stop, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalised on the whole buffer: a "\r\n" can arrive split across two chunks.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = parseBlock(block);
        if (event) onEvent(event);
      }
    }
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

/** One SSE block: `event:`, `id:`, and `data:` lines; comments (`:`) are keep-alives. */
function parseBlock(block: string): SseEvent | undefined {
  let event = "message";
  let id: string | undefined;
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
    else if (field === "id") id = value;
  }
  if (!data.length && !id) return undefined;
  return { event, data: data.join("\n"), ...(id ? { id } : {}) };
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The message in a `message.upsert`: the payload itself, or under `message`. */
function asMessage(payload: unknown): CheckoutMessage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as { message?: unknown };
  const m = (
    p.message && typeof p.message === "object" ? p.message : payload
  ) as Partial<CheckoutMessage>;
  return typeof m.id === "string" && Array.isArray(m.parts) ? (m as CheckoutMessage) : undefined;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
