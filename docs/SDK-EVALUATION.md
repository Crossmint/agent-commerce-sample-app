# Crossmint SDK component evaluation

## Working agreement

- Work from the latest `origin/main` on `codex/evaluate-agent-commerce-sdk`.
- Never push to `main`. Deliver through a pull request; the user performs the merge.
- Use Crossmint production exclusively for component and checkout evaluations. Use the existing Stytch test credentials for local authentication, as subsequently requested by the user. Crossmint staging is outside this evaluation's scope.
- QA and the developer-facing report cover Crossmint SDK components and their hosted UI exclusively. The sample app is a test harness, not a QA target. Keep app/auth-provider/AI SDK observations out of the report except for necessary reproduction context or coverage blockers; never count custom app flows as SDK component coverage.
- Integrate and evaluate one component at a time with the user. Do not silently work around SDK bugs before recording them.
- Review browser console, relevant network requests, and server logs during each active test session. Background monitoring outside active sessions is not configured.
- Record only redacted diagnostics: no API keys, JWTs, card numbers, CVCs, passwords, or vault tokens.
- Treat each joint component test as QA evidence for `docs/SDK-QA-REPORT.md`. Triage all available logs, but report only component-relevant evidence. Read browser and server diagnostics after each action; record successes, failures, warnings, and unobserved behavior separately. Snapshot available logs before intentional restarts and attach reviewed excerpts to findings. Never count browser messages forwarded to the server as separate incidents.
- Capture continues while the development server runs; analysis happens during active Codex sessions. No background analysis automation is configured. Missing iframe/network visibility must remain explicit in the report.

## Baseline

- Application base: `818cc82`.
- Original React UI SDK: `4.7.0`; installed evaluation version: exactly `4.8.0` in both `apps/web` and `packages/ui`.
- Release: https://github.com/Crossmint/crossmint-sdk/pull/2075
- Existing integrations: payment method management, CVC recollection, order intent verification.
- Evaluation environment: Crossmint production for both individual components and full Agent Checkouts; Stytch test for local sign-in.
- Runtime results are recorded under Joint evaluation findings below; verification and CVC recollection remain pending.

## Evaluation sequence

1. Install the unchanged lockfile and run existing checks. Separate existing failures from regressions.
2. Upgrade the React UI SDK in both consumers and review the lockfile. Repeat the baseline flows before integrating new components.
3. Integrate `CrossmintAgentCardAuthorization` into checkout payment authorization. Check server ownership validation, persistence, and resumption without creating a second order intent.
4. Integrate `CrossmintProtectedInput` for merchant password requests, using the documented checkout response contract.
5. Review the exported CVC types, error handling, verification, and appearance across the integrated flows.
6. Open a PR with the test record, known issues, and reproduction steps. Leave it unmerged.

## Cases to exercise with the user

| Area | Cases |
| --- | --- |
| Existing flows | Save a card, select a saved card, cancel, reopen, verification success/failure, CVC refresh and retry |
| Agent card authorization | New/saved card, rail selection and unavailable rails, registration, exact amount/currency/merchant, verification, one successful callback and one checkout response |
| Protected input | Load, submit, validation errors, retry, cancel/reopen, identifier handoff, no secret exposed to application callbacks or diagnostics |
| Lifecycle | Expired/refreshed JWT, slow/failed requests, rapid repeated clicks, unmount during work, remount, stale checkout request |
| Presentation | Loading/error states, keyboard navigation, focus, narrow viewport, iframe height, theme and appearance units |
| Recovery | Retry only when appropriate, actionable error text, no duplicate authorization or submission after recovery |

## Evidence required for each finding

- ID and classification in this internal notebook: SDK, application integration, backend/environment, or undetermined. Only component findings belong in the developer-facing report; undetermined ownership must be explicit.
- SDK version, environment, browser, timestamp, and sanitized correlation IDs when available.
- Preconditions and exact reproduction steps.
- Expected and actual behavior; frequency and user impact.
- Redacted console/network/server evidence. State explicitly when an iframe's internal diagnostics are unavailable.
- Suspected cause kept separate from confirmed cause.
- Proposed fix, regression check, and retest result.

## Results

- Baseline `pnpm install --frozen-lockfile`: completed without manifest or lockfile changes. Installation reported missing MCP build output before the workspace was built, and skipped dependency build scripts.
- Baseline `pnpm test`: passed, 119 tests across 16 test files (auth 3, core 21, MCP 12, server 52, CLI 31).
- UI coverage gap: `@agent-commerce/ui` has no test files and exits successfully through `--passWithNoTests`. This run does not test the Crossmint React components in a browser.
- Server tests emit buyer-profile lookup warnings from incomplete mocked routes (`no fake for GET /api/unstable/agent-checkouts/buyer-profiles`). These are baseline test-harness diagnostics, not evidence of a live SDK failure.
- Browser-use CLI diagnostic exited with code 134; evaluation uses the Codex in-app browser instead.

## Steps 1–2: production setup and SDK upgrade (2026-09-25)

### Configuration and observability

- Created a private, gitignored `apps/web/.env.local` using the existing production credentials. No credentials are included in this PR.
- Initially set Crossmint to `production` and Stytch to `live`. After EVAL-001, switched only Stytch to the root `.env` test credentials at the user's request. Browser/server Crossmint client keys match; the application base URL is `http://localhost:3000`.
- The root `.env` alone was not sufficient for Next's app-directory environment loading. Its default Stytch variables also pointed to test, so the explicit production values were mapped locally to the names the application reads.
- No database is configured locally; the existing in-memory store is used. Local request associations will not survive a server restart.
- Run `pnpm --filter @agent-commerce/web dev --hostname 127.0.0.1` after building workspace packages. Open `http://localhost:3000/app` (use the same origin consistently).
- Development logging forwards browser console output to the terminal, enables server fetch diagnostics with shortened URLs, and disables Server Function argument logging. This configuration does not enable logging in a production build.
- Verified browser console access and forwarding: the same Stytch error appears in the browser console, the terminal, and `apps/web/.next/dev/logs/next-development.log`.
- During this session the terminal stream is also saved at `/tmp/agent-commerce-sdk-dev.log`. Next's local MCP `get_logs` endpoint confirms the combined log path above.
- Verified incoming request status/timing logs. This is not a complete browser Network capture: cross-origin iframe internals, browser request/response bodies, and successful third-party browser requests are not automatically captured by Next's logs.

### Upgrade

Only these package versions changed in the lockfile; no new direct SDK dependency was added:

| Package (`@crossmint/`) | Before | Installed |
| --- | --- | --- |
| `client-sdk-react-ui` | 4.7.0 | 4.8.0 |
| `client-sdk-base` | 4.0.0 | 4.1.0 |
| `client-sdk-react-base` | 2.3.0 | 2.3.1 |
| `client-sdk-auth` | 1.3.23 | 1.3.24 |
| `common-sdk-base` | 0.12.1 | 0.12.2 |
| `common-sdk-auth` | 1.1.21 | 1.1.22 |
| `client-signers` | 0.3.0 | 0.3.1 |
| `wallets-sdk` | 1.17.0 | 1.18.0 |

Existing component integrations are unchanged. Neither `CrossmintAgentCardAuthorization` nor `CrossmintProtectedInput` has been integrated yet.

### Validation

| Check | Result |
| --- | --- |
| `pnpm exec turbo run test --force` | 119 tests passed across 16 files, no cache |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed across all workspace packages |
| Workspace package builds | Passed |
| `pnpm --filter @agent-commerce/web build` | Passed, including TypeScript and prerendering |
| Browser `/app` | HTTP 200; login screen renders |
| `GET /api/agent-commerce/v1/config` | HTTP 200, Crossmint `production`, auth `test`, expected local base URL after the requested auth change |
| `GET /api/agent-commerce/v1/payment-methods` without a session | HTTP 401 `unauthorized`, as expected |
| Save/select card, verification, CVC refresh | Pending joint sign-in; not yet tested interactively |

The first restricted build could not download Google Fonts. A retry initially reused a Turbopack permission error; moving the generated build cache aside and running the web build with the required local/network permissions succeeded. No application workaround was introduced.

Installation reports peer warnings involving Zod 4 versus a transitive Zod 3 expectation and React 19 versus transitive React Native/React 18 expectations. These dependency paths already existed in the baseline; no runtime failure has been attributed to them. The fresh test run still emits the mocked buyer-profile warnings noted above.

### EVAL-001 — Stytch production rejects the local origin

- **Classification:** environment configuration; initially blocked authenticated component evaluation with Stytch live.
- **Reproduction:** start the production-configured local app and open `http://localhost:3000/app`.
- **Expected:** Stytch initializes for this origin and allows sign-in.
- **Actual:** the login screen renders, but Stytch reports HTTP 400 `bad_domain_for_stytch_sdk`, followed by an RBAC-policy retrieval error.
- **Evidence:** matching browser console and Next development log entries; live Stytch request IDs are retained in local logs. Reproduced on subsequent page initialization.
- **Disposition:** the user requested the existing Stytch test credentials instead. Changed the private local environment only; no Stytch provider permissions were changed. Crossmint remains in production.
- **Retest:** a fresh browser session renders the login screen with no console warnings/errors, and the public config endpoint confirms `production`/`test`. Sign-in and the card flows are still pending; this does not establish that the resulting JWT is accepted by Crossmint or that its allowed-origin configuration is correct.

A passing automated suite alone does not establish component correctness. The draft PR remains an upgrade and observability checkpoint, with authenticated regression tests explicitly pending.

## Joint evaluation findings (2026-09-28)

This internal history includes setup blockers and harness observations to avoid misattributing them to Crossmint. EVAL-001, EVAL-002, and EVAL-004 are outside the component report; only necessary reproduction context is carried over. App follow-up suggestions below are historical notes, not planned QA work or SDK defects.

### EVAL-002 — Saving a card fails JWT authentication

- **Classification:** authentication configuration; exact Crossmint trust configuration has not yet been inspected.
- **Reproduction:** sign in with Stytch test, open Add a card, complete the form, and submit. The user observed this in the existing payment-method-management component on SDK 4.8.0.
- **Expected:** Crossmint authenticates the buyer's session and saves the payment method.
- **Actual:** the embedded form reports that a JWT signing key is absent from the JWKS for a `jwk-test-…` key ID. Its combined authentication error also reports that an alternative method requires a server-side API key. The local payment-methods read returned HTTP 401 as well.
- **Configuration finding:** the initial setup selected the explicit `*_PRODUCTION_*` Crossmint key pair from the root `.env`. After switching Stytch to test, that pair remained active. The original, unsuffixed Crossmint key pair in `.env` is different and is also production. Selecting a key solely by the environment suffix did not establish that it trusted the selected Stytch project.
- **Local change:** restored the original `CROSSMINT_SERVER_API_KEY` and `NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY` from the root `.env`; mirrored the latter into server-side `CROSSMINT_CLIENT_API_KEY`. Stytch remains test and Crossmint remains production. No credentials or provider trust settings were published or changed.
- **Hypothesis:** the explicit production pair belongs to a configuration that does not trust this Stytch test signing key. Restoring the original pair is a configuration correction to test, not yet a confirmed resolution.
- **Retest:** the user's subsequent submission reached `POST /v1/payment-methods/:id/register` with HTTP 200, and the approval UI displays the saved card selected. This confirms that authenticated registration works with the original Crossmint production pair and Stytch test. The iframe's direct save request was not independently captured. Verification and CVC recollection have not yet been reached.
- **Evidence handling:** only the error category and redacted key-ID prefix are recorded. The user's screenshot contains payment details and is not copied into the repository or PR.

### EVAL-003 — Embedded form exposes an actionable-looking but misleading auth error

- **Classification:** confirmed user-facing error presentation issue in the hosted form; ownership between the SDK and hosted backend remains to be determined.
- **Observed:** the form prints a long aggregate authentication error, including duplicate `API Key` method names, a JWKS key identifier, and instructions to use a server-side API key. This is shown beneath Continue to the buyer.
- **Impact:** the buyer cannot fix provider trust settings, and the server-key wording can mislead an integrator into replacing a browser client key with a secret. The application must continue using a client key plus buyer JWT in the browser.
- **Proposed behavior:** show a concise authentication failure and a relevant recovery action to the buyer; expose structured, redacted diagnostics to the integrator separately. Do not recommend a server key from the client-side card form.
- **Status:** recorded from the supplied screenshot; no SDK or hosted-form workaround applied.

### EVAL-004 — Environment reload loses an approval request while the UI still offers Allow

- **Classification:** confirmed sample-app/local persistence and stale-state handling issue, not a Crossmint component failure.
- **Reproduction:** create an agent-card request and leave its approval UI open; reload the server environment while using the in-memory store, then press Allow.
- **Evidence:** the same request returned HTTP 200 before the logged `.env.local` reload and HTTP 404 immediately afterward. Subsequent reads continue returning 404, as does `POST /v1/agent-card-requests/:id/approve`. `DATABASE_URL` is absent, and `buildStore()` creates `memoryRequestStore()` with a new `Map`.
- **Cause:** correcting the key selection reloaded the server module and lost the in-memory request. The previous request data remains in `useResource` after a failed refetch. `useAgentCardRequest` continues polling based on that stale `pending` state; `ApproveAgentCard` still enables Allow when a card is selected.
- **Impact:** the UI invites repeated approval attempts for a request that no longer exists and polls it repeatedly. This failed approval exits in `loadOwnedRequest`, before registration or order-intent creation in Crossmint.
- **Current test recovery:** close the old approval and create a new request, using the already-registered card. Do not reconstruct authorization from stale browser data. Avoid reloading the environment during the next attempt.
- **Follow-up fixes:** handle a terminal not-found response by stopping polling and clearing/disabling stale approval actions, with a clear instruction to request a new authorization. Use the existing database-backed store for evaluations that must survive server reloads.
- **Status:** documented; no persistence or UI workaround has been applied during this evaluation step.

## Authorization wrapper (2026-09-28)

- Added and exported `AuthorizeAgentCard` and `AuthorizeAgentCardProps` from `@agent-commerce/ui`.
- The wrapper accepts the SDK's props except `jwt`, which comes from `useAgentCommerce`, and mounts the component inside the existing `CrossmintScope`. Missing configuration/session and provider loading/failure have explicit fallback text.
- Props, SDK defaults, and callback payloads are preserved. The wrapper performs no backend registration, approval, or checkout mutation of its own.
- Callback diagnostics use `[sdk-evaluation] authorization.completed` with order-intent ID, rail, and provider, and `authorization.failed` with the error code only. Full result/error objects, JWTs, and card details are not logged by the wrapper.
- Validation: UI package typecheck and build passed, including generated public declarations. These are integration checks, not runtime SDK QA evidence.
- The wrapper is not mounted in a screen yet. Interactive evaluation and callback verification remain pending; no production authorization was initiated for this change.


## Replace the existing authorization flow (2026-09-28)

- User approved adapting the product to the SDK, including requiring a specific merchant. `ApproveAgentCard` is now the shared host for `AuthorizeAgentCard` in desktop/mobile/messaging, the approval URL, and checkout views. The custom picker, Allow action and manual registration/creation/verification/CVC sequence were removed from new approvals.
- `/authorized` accepts only `orderIntentId`, reads it under the buyer JWT and validates active status, a card rail, amount/currency, merchant, description and expiry. Atomic store transitions protect against duplicate callbacks and concurrent denial. Old `/approve` and `/verified` routes are removed.
- Chat/MCP tools and CLI inputs now carry explicit merchant metadata. Checkouts store it for the later payment step. The SQL migration is generated, not applied to an external database; local evaluation uses memory storage.
- Browser recovery after the callback stores only the opaque order-intent ID. The SDK retains ownership of in-progress authorization behavior; pre-callback unmount/recovery remains a joint test.
- App login screen renders in the available automation browser. No authenticated SDK submission or purchase was performed during implementation.
- Validation: 141 tests passed across core, auth, server, MCP and CLI; workspace typecheck/lint, package builds and the production web build passed. The final server rerun passed all 70 tests. Local `/app` responds HTTP 200; the unauthenticated browser smoke check reported no warnings/errors. These checks validate the integration, not the SDK's authenticated runtime behavior.

## Checkout connection failures reported after integration (2026-09-28)

- Two recent attempts logged `could not resolve a browser profile` followed by `TypeError: fetch failed`, with an `AggregateError` cause code `ETIMEDOUT`. The fatal stack is `CrossmintClient.request` → `createCheckout` → the chat tool. The failure occurs during checkout creation, before a payment-step request or the authorization component.
- The chat route still returns HTTP 200 because tool failures are handled inside the streamed conversation; that status does not mean checkout succeeded. No `[sdk-evaluation]` authorization callbacks appear in the captured server log.
- Subsequent read-only, unauthenticated GET probes to the production checkout endpoint returned HTTP 403 in approximately 0.4 seconds using both curl and Node fetch. Connectivity responded at probe time; these probes do not establish authenticated API health or explain the earlier timeouts. No checkout POST was replayed.
- Other nearby messages: favicon HTTP 400 responses for partial streamed hostnames and an AI SDK `JSON Schema propertyNames` compatibility warning. Neither is evidence of a Crossmint React component defect.
- Browser-console inspection was unavailable because the connected browser exposed no tabs. This finding is retained as integration/environment context only, outside the component bug report. Exact network cause and authenticated retry outcome remain unverified.

## Repeated authorization: currency conversion and payment field mismatch (2026-09-28)

- Checkout `fc15ba16-4642-4654-9846-fa1a28354f5c`: user screenshots show successive approved limits of USD 16.00 and USD 18.20, then another request for USD 18.20. The Arc checkout history was inspected read-only through its expanded progress rows after native browser access became available.
- The conversation states the merchant total is EUR 16.00 with free standard shipping, followed by the user's instruction to use euros. Nevertheless, the first approval is displayed as USD 16.00. The exact tool argument that introduced USD was not captured.
- The first continuation says it is reconciling the merchant's euro total with the USD card authorization and checking the exchange rate. The next continuation explicitly says it is applying the authorized card to the EUR 16.00 checkout using a reference conversion of USD 18.20. This explains the displayed increase as conversion, not evidence of shipping or a price increase; the exchange rate itself was not independently validated.
- That continuation then reports that the payment tool encountered a `field mismatch`, followed by clearing a partially entered card number before requesting fresh authorization. This is the observed reason for the third approval request at the same USD 18.20 amount. The progress narrative does not identify the exact mismatched field or prove a bank decline.
- Local logs correlate two successful `authorization.completed` and `authorization.attached` events with order intents `316c2010-4514-4c71-a346-9aa66b999cd7` and `d3b027e5-942f-4afe-bdf5-78bb7774f999`, submitted for checkout payment actions `0e15852c-807e-41fd-ada0-b0cc417d9f93` and `e81744db-5cbc-4af1-a3f9-afd7f7a21904` respectively.
- Attribution: currency handling and the checkout agent's payment-form workflow require investigation. No evidence here establishes a defect in `CrossmintAgentCardAuthorization`. No new authorization, payment, or checkout action was submitted during inspection. The earlier EUR 16.00 repetition on checkout `834ee85a-de7b-485b-944f-75676c067d4d` remains separately unexplained; this evidence must not be applied to it without its transcript.
