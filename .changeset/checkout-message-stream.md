---
"@agent-commerce/core": minor
"@agent-commerce/server": minor
"@agent-commerce/ui": minor
---

Checkout messages stream instead of being polled.

Core gains `checkouts.streamMessages`, Crossmint's `text/event-stream` of `message.upsert` and `run.updated` events, resumable from a cursor. The server passes it through at `GET /v1/checkouts/:id/messages/stream`. `useCheckoutMessages` reads the history once, then follows the stream, so new messages show as they are written; when the stream closes it re-reads the history and reconnects from its cursor, backing off when a stream keeps closing empty. Its `onEvent` reports each event, and `checkoutChanged` says which ones call for reading the checkout again. `CheckoutView` and the chat read the checkout on those events, and poll it only every `CHECKOUT_FALLBACK_POLL_MS` (10s) as a fallback.
