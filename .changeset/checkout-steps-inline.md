---
"@agent-commerce/ui": minor
"@agent-commerce/core": patch
---

Checkouts show what the agent does, not its browser.

`CheckoutView` no longer embeds the agent's browser. It reads the run's transcript and lists each thing the agent reports as a step that ticks off when it moves on, with the open question or the payment step under the steps. `frameHeight` is gone. A question that is one choice shows its options as buttons, and a tap answers it.

`PendingActionForm` no longer clears what the user typed on every poll: it starts over only for a new question.

New in the UI package: `CheckoutSteps`, `checkoutSteps` and `useCheckoutMessages`, and `listCheckoutMessages` on the API client. `useResource` keeps polling after a failed read, so a checkout that loses contact for a moment picks up again. The unused `.ac-window` style is gone.

Core's tool docs gain two chat-only tools. `watch_checkout`: the chat follows a checkout, posts each update from the store's agent as a message, and hands back to the model when the store asks a question, the run reaches its payment step, or it ends. `pay_checkout_with_agent_card`: pay the payment step from an agent card the user already has.
