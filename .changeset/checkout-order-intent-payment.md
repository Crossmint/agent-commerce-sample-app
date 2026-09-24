---
"@agent-commerce/core": minor
"@agent-commerce/server": minor
"@agent-commerce/ui": patch
---

Checkouts pay with an order intent, as Agent Checkouts now requires.

The run's payment step is a payment input request (`interaction.kind: "payment"`) stating the amount and the merchant's domain. The server answers it with `input_response` `{ kind: "payment", orderIntentId }` instead of minting a card and filling the store's card form, which Agent Checkouts no longer accepts. The agent card it raises for the step is made as the order intent must be: the exact amount the request states, no merchant, and a two-hour expiry. When the run asks again after an authorization fails, a fresh request is raised and the failed card is not offered again. An existing agent card chosen for a checkout must cover the amount.

Messages to a run now carry one part each, as Crossmint accepts: an answer with a note goes as two messages.

Core gains `paymentResponse`, `checkouts.payWithOrderIntent`, the payment fields on `CheckoutInteraction`, and `payment` on `PendingUserAction`; `isPaymentAction` recognises payment requests. `fillPaymentAction` is gone.
