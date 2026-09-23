---
"@agent-commerce/ui": minor
"@agent-commerce/server": minor
"@agent-commerce/core": minor
"@agent-commerce/mcp": patch
---

A saved card whose vaulted security code lapsed can be brought back, without anyone but the user seeing the digits.

Crossmint keeps a card's security code in its vault only for a while. When that copy lapses, the rail behind the card reports `pending_cvc_recollection` and mints nothing. Core names the status, reads it raw with `pendingCvcRecollectionRails`, and answers the question that matters with `needsCvcRecollection` — true only when no other rail on the card will pay. Rails are tried in order, so a live network rail never reaches the encrypted-card fallback: a lapsed code behind it is not the user's problem yet, and no badge, pile, row action or approval step mentions it. `CrossmintApiError.isCvcRecollectionRequired` catches the other signal, the `409 ORDER_INTENT_CVC_RECOLLECTION_REQUIRED` Crossmint returns when the vault lapses during a mint.

The server folds both into one answer: `409 cvc_recollection_required`, carrying `details.paymentMethodId`, because the field the user types into is keyed by the saved card rather than by the budget. `approve` now reports `needsCvcRecollection` beside `needsVerification`. Over MCP the agent is told the digits are the user's to type and not to ask for them.

New `<RecollectCvc paymentMethodId>` wraps Crossmint's `CrossmintCvcRecollection`, in the page's own theme through `paymentMethodAppearanceFromTheme`. It shows up wherever verification already did: a "Needs security code" pile and an "Enter the security code" row action in `AgentCardTable` and `AgentCardList`, a button on `AgentCardDetail`, and a step of `ApproveAgentCard` for a card that comes back wanting it. `AgentCardGroup` gains `"needs-cvc"`.

Needs `@crossmint/client-sdk-react-ui` 4.7.0, which the packages now ask for.
