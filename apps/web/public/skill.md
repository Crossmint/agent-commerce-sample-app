---
name: agent-commerce
description: Pay for things with the user's own card through Agent Commerce. Use this whenever the user asks you to buy, order, purchase, pay for, or check out something, or to request or reveal a card, agent card, or budget, or when a task needs money and the user has Agent Commerce set up. The `agent-commerce` CLI starts a checkout at any URL; when the run reaches its payment step the user picks a payment method in a browser, and Crossmint pays with a card minted for that purchase. Never handle the user's real card details yourself.
---

# Agent Commerce: pay with the user's card, with their approval

Agent Commerce wraps the Crossmint Agents APIs. You never see a Crossmint key. The user approves every budget in a browser.

Four objects:

- **Payment method**: a card the user saved in the wallet website. Agent cards are minted from these.
- **Agent card**: scoped, user-approved spending on one payment method. Has an amount, a description, an expiry, and an optional merchant lock.
- **Checkout**: Crossmint buys at a URL. Start here. It reaches a **payment step** of its own, where the user chooses a payment method and an agent card is minted for that purchase.
- **Credential**: a scoped card number minted from an agent card, for paying somewhere a checkout cannot reach. Last resort.

**Do not request an agent card before buying something.** The checkout asks for one when it needs it.

## Before anything

Check the session:

```sh
agent-commerce whoami
```

Exit code 3 means not logged in. Ask the user to run `agent-commerce login --api <their wallet API url>` in their own terminal. Do not run login for them unless they ask. Login opens a browser; in a headless shell it needs `--code`.

If `AGENT_COMMERCE_API_URL` and `AGENT_COMMERCE_TOKEN` are set, no login is needed.

## Step 1: start a checkout

```sh
agent-commerce checkout create --url <product url> --max-cost 60 --task "size 10, blue, cheapest shipping" --wait
```

No `--agent-card`. The run gets its card at the payment step, in step 2.

Crossmint drives the shop's checkout in a real browser. It fills in the card itself. You never see the number. `--max-cost` is a hard cap: the run stops as `blocked` instead of paying more. Put everything you know in `--task` (size, color, shipping choice, "pay by card"): the more you say, the fewer questions the agent stops to ask.

Exit codes while waiting:

- Exit 0: succeeded. The output shows the total and the order id. Report both to the user.
- Exit 2, **payment step**: see step 2.
- Exit 2: the agent asked a question (shipping address, size, a confirmation). The output shows the question, lists the fields, marks required ones with `*`, and prints a ready `agent-commerce checkout answer` command with a values template. Fill it in from what you know; ask the user for anything you do not know. Answer before the printed expiry or the checkout fails. Then run:

```sh
agent-commerce checkout answer <checkoutId> <requestId> --values '{"fullName":"Ada Lovelace","country":"US"}' --wait
```

To refuse a question use `--decline`; to suggest another way use `--alternative "use the cheapest shipping"`. To steer the agent mid-run without a question pending, `agent-commerce checkout message <checkoutId> "<note>"`.

```sh
agent-commerce checkout cancel <checkoutId>   # if the user changes their mind
```

- Exit 1: blocked, failed or cancelled. `blocked` means the agent stopped on purpose (over the cap, item unavailable, store blocked it); `failed` means the run broke. The output has the code or reason and a summary. Tell the user.

Shipping details repeat across purchases. Create a buyer profile once with `agent-commerce buyer-profile create --json-file profile.json` and pass `--buyer-profile <id>` to `checkout create`.

Merchant logins are kept for you. A store the user signed into on an earlier checkout has them signed in on the next one, so do not ask for merchant passwords and do not pass `--browser-profile`. If a run is stuck on a stale or half-finished login, retry it once with `--fresh-browser` and let the user sign in again.

Check on any checkout later with `agent-commerce checkout get <id> --wait`.

## Step 2: the payment step

Partway through, the run needs a way to pay. It stops with exit 2 and prints a **payment step** with a URL:

```
Payment step. Open this to choose a payment method:
https://wallet.example.com/approve/acr_123
```

**Show that URL to the user verbatim.** They open it, pick one of their saved payment methods, and that mints an agent card for this purchase alone, locked to this store and capped at your `--max-cost`. Crossmint then pays the store with it. You never see the number, and there is nothing here for you to answer: do not try `checkout answer`, and never send card fields.

Then keep waiting:

```sh
agent-commerce checkout get <checkoutId> --wait
```

If the user declines, the run stays stuck. Tell them, and cancel it if they are done.

## Step 3, only if needed: an agent card of your own

Ask for one only when the user wants a card for something a checkout cannot reach — a phone order, a form you drive yourself — or when they ask for one outright.

```sh
agent-commerce agent-card request --amount 60 --description "Blue running shoes, size 10" --wait --timeout 600
```

The command prints an approval URL. **Show that URL to the user verbatim.** They open it, pick a payment method, and approve. `--wait` blocks until the request is active, denied, or expired.

- Exit 0: approved. The output shows the agent card id.
- Exit 1: denied or expired. Tell the user. Do not retry without asking.
- Exit 2: still pending when the timeout hit. Show the URL again and resume with `agent-commerce agent-card status <requestId> --wait`.

Lock the card to one shop when you know it: `--merchant-name "Nike" --merchant-url https://nike.com --merchant-country US`. If you leave the card open, you must name the merchant later at `reveal` time. Card networks issue a number per merchant.

To spend an existing card on a checkout instead of choosing at the payment step, pass `--agent-card <id>` to `checkout create`. Only do that when the user asks to pay with that card.

Use `--json` when you need to read fields programmatically.

## Step 4, only if needed: reveal a card number

Use this only when a checkout is not possible, for example a phone order or a form Crossmint cannot drive.

```sh
agent-commerce agent-card reveal <id> --merchant-name <store> --merchant-url <https://store> --merchant-country <CC> --amount 25
```

Rules:

- **Never paste the card number, expiry, or CVC into the chat, into logs, into files, or into commit messages.** Type it directly into the payment form and nothing else.
- If the reveal comes back `cvc_recollection_required`, Crossmint's copy of the card's security code lapsed. Only the user can type it again, in the wallet under Cards. Say so and wait. **Never ask the user for the digits here** — they belong in Crossmint's own field and nowhere else.
- If the output warns `limit not enforced by the network`, the budget is advisory. Stop and prefer `agent-commerce checkout create`, or confirm the exact amount with the user first.
- Ask for the smallest `--amount` that covers the charge.

## Other commands

```sh
agent-commerce cards list                 # saved cards: brand, last4, id
agent-commerce agent-card list            # budgets and their remaining amounts
agent-commerce agent-card get <id>
agent-commerce agent-card revoke <id>     # do this when a task is done and money is left
agent-commerce logout
```

## Exit codes

| Code | Meaning        | What to do                                             |
| ---- | -------------- | ------------------------------------------------------ |
| 0    | ok             | continue                                               |
| 1    | error          | read stderr, tell the user                             |
| 2    | needs the user | show the payment step or approval URL, or answer the checkout question |
| 3    | not logged in  | ask the user to run `agent-commerce login`                       |

Errors go to stderr. With `--json`, errors are `{ "error": { "code", "message" } }`.

## Example: buy a book

```sh
agent-commerce whoami
agent-commerce checkout create --url https://bookshop.example/p/pragmatic --max-cost 35 --task "paperback, cheapest shipping" --wait
# → exit 2: shipping fields
agent-commerce checkout answer run_123 req_1 --values '{"fullName":"Ada Lovelace","addressLine1":"1 Main St","city":"Austin","postalCode":"78701","country":"US"}' --wait
# → exit 2: payment step. Show the URL; the user picks a card there
agent-commerce checkout get run_123 --wait
# → exit 0: succeeded, order ORD-9
```

No agent card was requested: the payment step made one for this purchase, capped at 35 and locked to the store.

## Do not

- Do not ask the user for their real card number. Agent Commerce exists so you never need it.
- Do not request an agent card just to buy something. Start the checkout and let its payment step ask.
- Do not request more budget than the task needs.
- Do not try to answer the payment step with `checkout answer`, and never put card fields in `--values`.
- Do not loop on `request` after a denial.
- Do not print revealed card details anywhere except the payment form.
