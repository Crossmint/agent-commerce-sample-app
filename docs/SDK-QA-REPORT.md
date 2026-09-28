# Agent Commerce SDK QA report

Working report for the SDK and sample-app developers. Evaluation is in progress; this is not a release sign-off.

## Environment and scope

- Crossmint React UI SDK: **4.8.0**, pinned in both consumers.
- Crossmint APIs: **production**. Authentication: **Stytch test**, using the original key pairing supplied in the project's private environment.
- Application: Next.js 16.3.5, React 19.2.8, local development at `http://localhost:3000`.
- Branch: `codex/evaluate-agent-commerce-sdk`; review: https://github.com/Crossmint/agent-commerce-sample-app/pull/1
- Evaluated so far: existing card-management integration and sample-app approval flows. `CrossmintAgentCardAuthorization` and `CrossmintProtectedInput` are not integrated yet.
- Test procedure, source analysis, and detailed reproduction history: [SDK-EVALUATION.md](SDK-EVALUATION.md).

## Evidence collection

Next forwards browser console output to the development terminal. We inspect the captured browser console when the tested tab is accessible, the combined Next JSON log, and the terminal's request/status/timing output.

| Evidence source | Coverage and limits |
| --- | --- |
| `apps/web/.next/dev/logs/next-development.log` | Browser and server messages. Browser messages may appear twice due to terminal forwarding. Next timestamps are process-relative, not wall-clock times. |
| `/tmp/agent-commerce-sdk-dev.log` | Retained terminal output, local HTTP results and server-side fetch diagnostics. It is not a browser HAR. |
| Private `.qa/` snapshots | Local, gitignored snapshots retained before logs rotate or the server restarts. Automated redaction is a first pass; manually review every excerpt before sharing. |
| User-supplied screenshots | Evidence of the visible UI. Screenshots containing card data are not copied into this report or repository. |

The current setup does **not** expose every successful browser request, iframe request/response body, or hosted backend log. In particular, a callback or downstream success is not equivalent to independently observing the iframe's save request. Record these as evidence gaps rather than assuming success.

After each joint action, correlate the component, step, timestamp, observed callback, relevant status codes and UI result. Preserve request IDs when useful and safe. Include redacted excerpts only; do not publish credentials, cookies, JWTs, PAN, CVC, passwords or vault tokens. Keep suspected causes separate from confirmed causes.

Logs continue being captured while the dev server is running. Codex reviews them during active work; no unattended analysis or alerting is currently configured.

## Findings

| ID | Finding | Ownership | Current disposition |
| --- | --- | --- | --- |
| EVAL-001 | Stytch live rejects localhost with `bad_domain_for_stytch_sdk` | Environment configuration | Local evaluation switched to Stytch test at the user's request; live-domain configuration was not changed. |
| EVAL-002 | Buyer JWT rejected because the configured JWKS lacks its test signing key | Environment/key pairing | Original production Crossmint key pair restored. Subsequent list, registration and approval requests succeeded. Exact provider trust settings have not been inspected. |
| EVAL-003 | Card form renders aggregate backend authentication errors and suggests a server-side API key | Hosted form / SDK error presentation; exact owner pending | Open. Confirmed visible behavior from the user's screenshot. |
| EVAL-004 | Approval request disappears on environment reload; stale UI keeps Allow enabled and polling | Sample-app persistence and UI state handling | Open. Confirmed by source and the 200 → reload → 404 log sequence. |

### EVAL-003: developer-facing diagnostics shown to the buyer

**Trigger:** submit the card form with the mismatched auth configuration from EVAL-002.

**Actual:** the form displays duplicate `API Key` authentication method names, a JWKS signing-key identifier and a recommendation to use a server-side key.

**Expected:** a concise authentication error with an appropriate recovery action for the buyer. Structured diagnostics should be available to the integrator without recommending that a secret key be placed in browser code.

**Acceptance check:** reproduce the auth failure; verify readable UI, a useful stable error code where supported, and diagnostics that do not expose payment data or credentials. Confirm the recommendation matches the client-key-plus-buyer-JWT integration.

### EVAL-004: stale approval survives loss of its server record

**Trigger:** open an existing approval request, then reload server configuration with no `DATABASE_URL` configured.

**Actual:** `memoryRequestStore()` loses the request. `useResource` preserves stale data after failed reads; polling continues from the stale pending status, and Allow remains enabled. Approval returns 404 before any Crossmint order-intent creation.

**Expected:** terminal not-found results stop polling and disable stale actions, with a clear path to request a new authorization. Tests that require restart persistence should use the existing database-backed store.

**Acceptance check:** remove the backing request or restart the in-memory server while the approval is visible; verify one terminal error state and no continued approval attempts/polling. Check that temporary network failures can still recover.

## Retained-log review: 2026-09-28

These counts describe the available terminal snapshot, including earlier setup and joint testing. They are request counts, not counts of distinct bugs or users.

| Observed request/result | Count | Interpretation |
| --- | ---: | --- |
| Read agent-card request → 200 | 108 | Requests existed before the reload. |
| Read agent-card request → 404 | 137 | Confirms repeated polling after a terminal missing-record response. |
| Approve agent-card request → 404 | 3 | Failed locally before order-intent creation. |
| Register payment method → 200 | 1 | Registration succeeded after restoring the original key pair. |
| List payment methods → 200 | 2 | Authenticated list requests succeeded. |
| Approve agent-card request → 200 | 1 | A subsequent approval handler succeeded; this alone does not prove network verification or checkout completion. |

Also observed an upstream Crossmint payment-methods **403** during the JWT failure, surfaced as a local API **401**. Do not confuse this with the expected unauthenticated 401 from the earlier API smoke test.

### Additional observations requiring triage

- **OAuth/PKCE:** one browser warning reports that Stytch could not find the OAuth code verifier in local storage. The server copy is the forwarded same warning. Verify initiation/callback origin and storage continuity before attributing this to an implementation defect.
- **AI SDK:** ten warnings in the retained combined log report that `JSON Schema propertyNames` was removed for OpenAI compatibility. Next labels these stderr entries as errors, but their content is a warning. Determine whether any tool relies on the removed constraint; no impact has yet been established.
- **Image loading:** two browser warnings identify `/powered-by-crossmint.svg` as LCP and suggest eager loading. These are sample-app performance observations, not Crossmint SDK failures. No controlled performance measurements have been made.
- **Unknown route:** four GETs to `/api/agents/:id` returned 404. Their initiator and relevance to this session have not been established.

## Coverage and remaining work

| Scenario | Evidence/status |
| --- | --- |
| Stytch test initialization | Login screen renders without the prior domain error. |
| Authenticated backend calls | Successful production list/registration/approval responses observed. |
| Add card | User advanced from the hosted form to a selected saved card; registration returned 200. Direct iframe save response not captured. |
| Card selection | Saved card visibly selected in the approval screen. |
| Cancel and reopen card form | Not systematically verified. |
| Order-intent verification | Not yet verified end to end. |
| CVC recollection | Not yet verified. |
| New authorization/protected-input components | Not yet integrated or evaluated. |

Automated baseline: 119 tests passed without cache; lint, typecheck, workspace builds and web build passed during the upgrade. There are no UI test files in the current UI package. These checks do not replace interactive SDK validation.
