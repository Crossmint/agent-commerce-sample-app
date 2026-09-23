---
"@agent-commerce/server": minor
"@agent-commerce/core": minor
"@agent-commerce/ui": patch
"@agent-commerce/mcp": patch
"@agent-commerce/cli": patch
---

Checkouts keep the user signed in to the stores they have signed into before.

Every Agent Checkout otherwise starts in a fresh browser, signed out, so a store that wants an account asks the user to log in on every purchase. Crossmint gives a user at most one browser profile, which keeps the state from that first login; the server now resolves it get-or-create and attaches it to every run. `browserProfileId` was already a pass-through on every surface, but nothing ever made one, so in practice no session was ever sticky.

Core gains `BrowserProfile`, `BrowserProfileInput` and `BrowserProfileList`, and `checkouts.listBrowserProfiles`, `createBrowserProfile` and `deleteBrowserProfile`. Whose logins these are is decided by the auth the existing `checkoutAuth` builds: a user JWT, or a server key with `x-crossmint-user-id` beside it — a server key alone would file every end user's logins under the project's own subject, in one shared profile.

`POST /v1/checkouts` takes `freshBrowser: true` to start signed out for one run, the way past a login that has gone stale; `--fresh-browser` on the CLI, `freshBrowser` on the MCP tool. An explicit `browserProfileId` still wins. New `GET /v1/browser-profile` reports the profile as metadata — Crossmint returns no cookies or tokens, and nothing about a login reaches a model or this server — and `DELETE /v1/browser-profile` signs the user out everywhere, which erases the stored browser state rather than just the record.

A 409 on create means a run in flight won the race, so the id is read back rather than the checkout failing. Any other failure is logged and the run goes ahead signed out: the convenience never fails a purchase.
