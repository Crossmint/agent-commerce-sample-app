---
"@agent-commerce/server": minor
---

A checkout can pay from an agent card the user already has.

`POST /v1/checkouts/:id/agent-card` pays a run's payment step from an existing agent card instead of minting a new one. The card must be active, have money left, and not be locked to another store; new error codes `agent_card_unusable`, `agent_card_wrong_merchant` and `checkout_finished` say which check failed.
