---
"@agent-commerce/server": minor
"@agent-commerce/ui": minor
---

Transactions: the server now records every credential an agent mints, and the wallet is a dashboard.

**Reveals.** `mintFromAgentCard` writes one row per credential — the budget, the card it drew on, the amount asked for, the merchant, the rail and whether that rail enforces the amount. Never the number, the token or the cryptogram. `GET /v1/reveals` reads them back, newest first, for the signed-in user only.

`RevealStore` is optional, like `CheckoutStore` and `SessionStore` before it: a store without `recordReveal`/`listReveals` keeps them in memory and the server says so once. `memoryRevealStore` and the `reveals` table in `@agent-commerce/server/drizzle` ship with it. A store that cannot write does not fail the mint — the agent already holds a live credential, and losing the audit line is the smaller harm. Run `db:generate` and migrate to add the table. `listReveals` takes an options object (`limit`, `agentCardId`), and the endpoint takes the same as query parameters, so one budget's panel can ask for its own slice.

**New in `@agent-commerce/ui`.** `AgentCardTable` puts budgets in rows: the description, the card behind it, what is left, when it lapses in words ("in 3 days"), the status, and a three-dot menu holding Verify and Revoke. `AgentCardList` stays for narrow columns. `agentCardGroup` sorts a budget into active, needs-verification or expired, from the same reading `agentCardStatusBadge` makes, so a group and its badge can never disagree.

A row opens: give `AgentCardTable` an `onSelect` and its rows become buttons, keyboard and all, with the actions menu holding its click back so the two never both fire. `AgentCardDetail` is what they open — a panel down the right on a desktop, a bottom sheet on a phone. It carries `AgentCardArt`, the budget drawn at a card's proportions with the network mark, what is left, what it is for and when it lapses; then the saved card behind it, the amounts and rails a table has no room for, and every credential minted from that one budget. `AgentCardArt` ships on its own too.

`CardMark` was private to the card picker and is now its own component with a `size`, so any list can lead with the network's artwork. `useReveals` fetches the transactions list, or one budget's. `formatRelativeTime` puts a moment into words.

New primitives, shadcn on Radix: `Table`, `DropdownMenu`, `Avatar`.
