# Crossmint SDK component QA report

Working report for Crossmint component developers. Evaluation is in progress; this is not a release sign-off. The sample app is only a test harness.

## Environment and scope

- Crossmint React UI SDK: **4.8.0**, pinned in both consumers.
- Crossmint APIs: **production**. Authentication: **Stytch test**, using the original key pairing supplied in the project's private environment.
- Test harness: Next.js 16.3.5, React 19.2.8, local development at `http://localhost:3000`.
- Branch: `codex/evaluate-agent-commerce-sdk`; review: https://github.com/Crossmint/agent-commerce-sample-app/pull/1
- Scope: behavior, API contracts, callbacks, lifecycle, accessibility, appearance, and error handling of the Crossmint SDK components exercised in this project, including their hosted UI.
- App features, custom hooks/wrappers, persistence, Stytch, and AI SDK behavior are outside the QA report. Their logs are used only to distinguish component failures from test setup failures. Setup problems are included only as necessary reproduction context or coverage blockers.
- A successful app request, custom card picker, or custom approval flow does not establish that the equivalent Crossmint component works.
- Internal setup and reproduction notebook: [SDK-EVALUATION.md](SDK-EVALUATION.md). Its historical environment/app observations are not SDK findings.

## Evidence collection

Next forwards browser console output to the development terminal. We inspect the captured browser console when the tested tab is accessible, the combined Next JSON log, and the terminal's request/status/timing output to isolate evidence relevant to the components.

| Evidence source | Coverage and limits |
| --- | --- |
| `apps/web/.next/dev/logs/next-development.log` | Browser and server messages. Browser messages may appear twice due to terminal forwarding. Next timestamps are process-relative, not wall-clock times. |
| `/tmp/agent-commerce-sdk-dev.log` | Retained terminal output, local HTTP results and server-side fetch diagnostics. It is not a browser HAR. |
| Private `.qa/` snapshots | Local, gitignored snapshots retained before logs rotate or the server restarts. Automated redaction is a first pass; manually review every excerpt before sharing. |
| User-supplied screenshots | Evidence of the visible UI. Screenshots containing card data are not copied into this report or repository. |

The current setup does **not** expose every successful browser request, iframe request/response body, or hosted backend log. A callback or downstream success is not equivalent to independently observing the iframe's save request. Record these as evidence gaps rather than assuming success.

After each joint component test, correlate the component, step, timestamp, observed callback, relevant status codes and UI result. Preserve request IDs when useful and safe. Include redacted excerpts only; do not publish credentials, cookies, JWTs, PAN, CVC, passwords or vault tokens. Keep suspected causes separate from confirmed causes. Do not count forwarded messages as separate incidents.

Logs continue being captured while the dev server is running. Codex reviews them during active work; no unattended analysis or alerting is currently configured.

## Component findings

Finding IDs retain their notebook identifiers; gaps do not indicate missing SDK findings.

| ID | Component / surface | Finding | Current disposition |
| --- | --- | --- | --- |
| EVAL-003 | Hosted card form reached through `CrossmintPaymentMethodManagement` | Renders aggregate backend authentication errors and suggests a server-side API key | Open. Visible behavior confirmed by the user's screenshot; ownership between hosted UI/backend and React SDK remains undetermined. |

### EVAL-003: developer-facing diagnostics shown to the buyer

**Observed:** 2026-09-28, SDK 4.8.0, Crossmint production with Stytch test. Browser/version was not captured. One supplied screenshot confirms the behavior; repeatability has not yet been systematically tested.

**Precondition:** a Crossmint project/key pairing that rejects the buyer JWT because its signing key is absent from the configured JWKS. The authentication configuration is a trigger, not itself an SDK defect.

**Reproduction:** sign in, open the SDK's new-card form, complete it, and submit while using that mismatched authentication configuration.

**Actual:** beneath Continue, the hosted form displays duplicate `API Key` authentication method names, a JWKS signing-key identifier and a recommendation to use a server-side key.

**Expected:** a concise authentication error with an appropriate recovery action for the buyer. Structured diagnostics should be available to the integrator without recommending that a secret key be placed in browser code.

**Impact:** the buyer receives configuration diagnostics they cannot act on, and the key recommendation can mislead integrators.

**Evidence:** user screenshot of the embedded form. Separately, logs show an upstream Crossmint payment-methods 403 surfaced by the harness as 401 during the authentication failure. That log is supporting context; the iframe's direct failed submission response was not captured.

**Retest status:** restoring the original production key pair allowed downstream registration to succeed, but this does not resolve or retest the component's error presentation. No workaround has been applied to the component.

**Acceptance check:** reproduce the auth failure; verify readable UI, a useful stable error code where supported, and diagnostics that do not expose payment data or credentials. Confirm the recommendation matches the client-key-plus-buyer-JWT integration.

## Component coverage and remaining work

| Component | Evidence/status | Next checks |
| --- | --- | --- |
| `CrossmintPaymentMethodManagement` | New-card form displayed; auth error presentation confirmed. User subsequently advanced to a saved card and downstream registration returned 200. Direct iframe save response and callback contract were not independently captured. | Verify save callbacks, SDK existing-card selection, cancel/reopen, retries, validation, and appearance. The app's custom card picker does not count as SDK selection coverage. |
| `OrderIntentVerification` | Integrated, not yet verified end to end. | Success/failure, cancellation, expiry, retry, and callback behavior. |
| `CrossmintCvcRecollection` | Integrated, not yet verified. | Validation, submission, callback contract, retry, cancellation, and sensitive-data handling. |
| `CrossmintAgentCardAuthorization` | `AuthorizeAgentCard` wrapper added and exported; not yet mounted in a test flow or evaluated interactively. | New/existing card, exact amount/currency/merchant, rails, verification, expiry, and callback cardinality. |
| `CrossmintProtectedInput` | Not yet integrated or evaluated. | Load, validation, submit, retry, cancel/reopen, identifier handoff, and sensitive-data handling. |

For each component, also exercise keyboard/focus behavior, narrow viewports, loading and error states, JWT expiry/refresh, slow or failed requests, repeated clicks, and unmount/remount. Harness build and unit-test results are retained in the internal notebook; they are not SDK component QA passes.
