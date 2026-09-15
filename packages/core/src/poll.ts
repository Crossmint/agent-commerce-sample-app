import type { Checkout, CheckoutStatus, OrderIntent } from "./types.js";
import { hasUsableRail } from "./rails.js";

export const TERMINAL_CHECKOUT_STATUSES: ReadonlySet<CheckoutStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);

export function isTerminalCheckout(checkout: Pick<Checkout, "status">): boolean {
  return TERMINAL_CHECKOUT_STATUSES.has(checkout.status);
}

export interface PollOptions {
  /** Milliseconds between polls. Crossmint suggests ~1500 for checkouts. */
  intervalMs?: number;
  /** Give up after this many milliseconds. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Poll until `done` returns true. Yields every fetched value so callers can stream progress.
 */
export async function* pollUntil<T>(
  fetchOnce: () => Promise<T>,
  done: (value: T) => boolean,
  opts: PollOptions = {},
): AsyncGenerator<T, T, void> {
  const interval = opts.intervalMs ?? 1500;
  const deadline = opts.timeoutMs ? Date.now() + opts.timeoutMs : Infinity;
  for (;;) {
    opts.signal?.throwIfAborted();
    const value = await fetchOnce();
    yield value;
    if (done(value)) return value;
    if (Date.now() + interval > deadline) {
      throw new Error("Polling timed out");
    }
    await sleep(interval, opts.signal);
  }
}

/** Poll a checkout until it is terminal or needs a user action. */
export function pollCheckout(
  fetchOnce: () => Promise<Checkout>,
  opts: PollOptions & { stopOnUserAction?: boolean } = {},
): AsyncGenerator<Checkout, Checkout, void> {
  const stopOnUserAction = opts.stopOnUserAction ?? true;
  return pollUntil(
    fetchOnce,
    (c) => isTerminalCheckout(c) || (stopOnUserAction && c.status === "awaiting_user_action"),
    opts,
  );
}

/** Poll an order intent until a rail is active or it is no longer active. */
export function pollOrderIntentUntilUsable(
  fetchOnce: () => Promise<OrderIntent>,
  opts: PollOptions = {},
): AsyncGenerator<OrderIntent, OrderIntent, void> {
  return pollUntil(fetchOnce, (oi) => oi.status !== "active" || hasUsableRail(oi), {
    intervalMs: 2000,
    ...opts,
  });
}

export async function drain<T>(gen: AsyncGenerator<T, T, void>): Promise<T> {
  let last: T | undefined;
  for (;;) {
    const r = await gen.next();
    if (r.done) return r.value ?? (last as T);
    last = r.value;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new Error("Aborted"));
      },
      { once: true },
    );
  });
}
