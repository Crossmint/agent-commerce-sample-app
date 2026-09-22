---
"@agent-commerce/ui": minor
"@agent-commerce/server": minor
"@agent-commerce/core": minor
---

Approval screen: the card form waits until it is asked for, and a failed verification is no longer a dead end.

`CardPicker` is now a dropdown of saved cards — the network artwork Crossmint sends on `display.imageUrl`, brand and last four, the default marked — with "Add a new card" under a rule at the foot. That row opens the form on its own surface: a bottom sheet under `sm`, a modal above it, both the new `AddCardDialog`. With no cards saved there is nothing to pick from, so the form takes the dropdown's place, which is the only time it shows up unasked.

Both endings carry a mark and a line saying the tab can be closed: a green check over "Your agent can spend up to …", a grey cross over "Your agent cannot use your card." **Breaking:** `ApproveAgentCard` no longer takes `mascotSrc`, since nothing on it draws the mascot now.

`ApproveAgentCard` takes the sign-in page's type — a display headline, the request as a hairline-ruled list, one lock line, a full-width Allow — in one column at every width. The request that will not load reads like a not-found page rather than a red panel. `variant="plain"` drops its own panel for a page that frames it (Agent Commerce's `/approve` puts it in a grid cell); the default `"card"` is unchanged. `platformName` (default "Agent Commerce") is the name the card network shows in its confirmation window — the platform, never the agent.

Verification that will not finish now offers "Try again" and "Use a different card". The server takes that second answer: `approve` and `deny` are allowed while a request is `approved` — the card exists but no agent can spend from it yet — and the order intent from the first answer is revoked.

`PaymentMethod` in core gains `display`, the artwork and label Crossmint returns with a saved card.

New primitives, all shadcn on Radix: `Dialog`, `Sheet`, and `Select`. **Breaking:** the styled native select is now `NativeSelect`; `Select` is the Radix one, whose rows can carry artwork and a badge.
