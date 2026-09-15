---
name: goat
description: Pay for things with the user's own card through GOAT. Use this whenever the user asks you to buy, order, purchase, pay for, or check out something, or to request or reveal a card, agent card, or budget, or when a task needs money and the user has GOAT set up. The `goat` CLI requests a bounded agent card, the user approves it in a browser, then Crossmint checks out at any URL or mints a scoped card number. Never handle the user's real card details yourself.
---

# GOAT: pay with the user's card, with their approval

GOAT wraps the Crossmint Agents APIs. You never see a Crossmint key. The user approves every budget in a browser.

Four objects:

- **Saved card**: a payment method the user added in the wallet website.
- **Agent card**: a bounded budget on one saved card. Has an amount, a description, an expiry, and an optional merchant lock.
- **Checkout**: Crossmint buys at a URL and pays with the agent card. Preferred.
- **Credential**: a scoped card number minted from an agent card. Last resort.

## Before anything

Check the session:

```sh
goat whoami
```

Exit code 3 means not logged in. Ask the user to run `goat login --api <their wallet API url>` in their own terminal. Do not run login for them unless they ask. Login opens a browser; in a headless shell it needs `--code`.

If `GOAT_API_URL` and `GOAT_TOKEN` are set, no login is needed.

## Step 1: request an agent card

Ask for the smallest budget that covers the purchase, plus a small margin for tax and shipping. Write a description the user will recognise.

```sh
goat agent-card request --amount 60 --description "Blue running shoes, size 10" --wait --timeout 600
```

The command prints an approval URL. **Show that URL to the user verbatim.** They open it, pick a card, and approve. `--wait` blocks until the request is active, denied, or expired.

- Exit 0: approved. The output shows the agent card id.
- Exit 1: denied or expired. Tell the user. Do not retry without asking.
- Exit 2: still pending when the timeout hit. Show the URL again and resume with `goat agent-card status <requestId> --wait`.

Lock the card to one shop when you know it: `--merchant-name "Nike" --merchant-url https://nike.com --merchant-country US`. If you leave the card open, you must name the merchant later at `reveal` time. Card networks issue a number per merchant.

Use `--json` when you need to read fields programmatically.

## Step 2: pay with a checkout (preferred)

```sh
goat checkout create --url <product url> --agent-card <id> --max-cost 60 --request "size 10, blue" --wait
```

Crossmint runs the shop's checkout. It fills in the card itself. You never see the number. `--max-cost` is enforced.

Exit codes while waiting:

- Exit 0: succeeded. The output shows the total and the order id. Report both to the user.
- Exit 2: the shop asked a question (shipping address, size, gift options). The output lists the fields, marks required ones with `*`, and prints a ready `goat checkout answer` command with a values template. Fill it in from what you know; ask the user for anything you do not know. Then run:

```sh
goat checkout answer <checkoutId> <actionId> --values '{"fullName":"Ada Lovelace","country":"US"}' --wait
```

- Exit 1: failed or cancelled. The output has the reason. Tell the user.

Shipping details repeat across purchases. Create a buyer profile once with `goat buyer-profile create --json-file profile.json` and pass `--buyer-profile <id>` to `checkout create`.

Check on any checkout later with `goat checkout get <id> --wait`.

## Step 3, only if needed: reveal a card number

Use this only when a checkout is not possible, for example a phone order or a form Crossmint cannot drive.

```sh
goat agent-card reveal <id> --merchant-name <store> --merchant-url <https://store> --merchant-country <CC> --amount 25
```

Rules:

- **Never paste the card number, expiry, or CVC into the chat, into logs, into files, or into commit messages.** Type it directly into the payment form and nothing else.
- If the output warns `limit not enforced by the network`, the budget is advisory. Stop and prefer `goat checkout create`, or confirm the exact amount with the user first.
- Ask for the smallest `--amount` that covers the charge.

## Other commands

```sh
goat cards list                 # saved cards: brand, last4, id
goat agent-card list            # budgets and their remaining amounts
goat agent-card get <id>
goat agent-card revoke <id>     # do this when a task is done and money is left
goat logout
```

## Exit codes

| Code | Meaning        | What to do                                             |
| ---- | -------------- | ------------------------------------------------------ |
| 0    | ok             | continue                                               |
| 1    | error          | read stderr, tell the user                             |
| 2    | needs the user | show the approval URL, or answer the checkout question |
| 3    | not logged in  | ask the user to run `goat login`                       |

Errors go to stderr. With `--json`, errors are `{ "error": { "code", "message" } }`.

## Example: buy a book

```sh
goat whoami
goat agent-card request --amount 35 --description "Book: The Pragmatic Programmer" --wait --timeout 600
# → show the approval URL; wait; read the agent card id oi_abc
goat checkout create --url https://bookshop.example/p/pragmatic --agent-card oi_abc --max-cost 35 --wait
# → exit 2: shipping fields
goat checkout answer co_123 act_1 --values '{"fullName":"Ada Lovelace","addressLine1":"1 Main St","city":"Austin","postalCode":"78701","country":"US"}' --wait
# → exit 0: succeeded, order ORD-9
goat agent-card revoke oi_abc
```

## Do not

- Do not ask the user for their real card number. GOAT exists so you never need it.
- Do not request more budget than the task needs.
- Do not loop on `request` after a denial.
- Do not print revealed card details anywhere except the payment form.
