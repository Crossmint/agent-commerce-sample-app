# @agent-commerce/cli

The Agent Commerce CLI. It lets an agent ask a user for a bounded agent card, then pay with it. The user approves in a browser. The agent never sees your Crossmint keys.

Works for humans too.

## Install

```sh
npm i -g @agent-commerce/cli
```

Node 20 or newer.

## Log in

```sh
agent-commerce login --api https://wallet.example.com/api/agent-commerce
```

The CLI reads `GET /v1/config` from that URL. It then runs an OAuth 2.1 PKCE login in your browser and stores the tokens in `~/.config/agent-commerce/config.json` (mode 0600).

No local browser? Use the paste flow:

```sh
agent-commerce login --code
```

It prints a URL. Open it anywhere, log in, and paste the code back.

For CI or an agent sandbox, skip login. Set `AGENT_COMMERCE_API_URL` and `AGENT_COMMERCE_TOKEN` instead.

Check the session with `agent-commerce whoami`. Remove it with `agent-commerce logout`.

## Flow 1: request an agent card

```sh
agent-commerce agent-card request --amount 50 --description "Flight to SF" --merchant-name United --merchant-url https://united.com --merchant-country US --wait
```

The command prints an approval URL. Show it to the user. They pick a saved card and approve. With `--wait` the command blocks until the card is active, denied, or expired.

Every new authorization requires a merchant. Supply `--merchant-name`, `--merchant-url`, and `--merchant-country`. Set the lifetime with `--expires-in-hours` (default 24).

Then:

```sh
agent-commerce agent-card list
agent-commerce agent-card get <id>
agent-commerce agent-card revoke <id>
agent-commerce agent-card status <requestId> --wait   # resume waiting on a request
```

## Flow 2: checkout at a URL (preferred)

Crossmint buys the item. It fills in the card itself. The card number never reaches the agent. Start here: no agent card is needed up front.

```sh
agent-commerce checkout create --url https://shop.example/p/1 --merchant-name Shop --merchant-url https://shop.example --merchant-country US --max-cost 100 --request "medium, black" --wait
```

When the run reaches its payment step it exits with code 2 and prints a link. Show it to the user: they pick a saved payment method there, which mints an agent card for this purchase alone. Then keep waiting with `agent-commerce checkout get <checkoutId> --wait`.

To pay from a card the user already approved, pass `--agent-card <id>` and the payment step never appears.

If the shop asks a question (size, shipping address), the command prints the fields and exits with code 2. Answer it:

```sh
agent-commerce checkout answer <checkoutId> <actionId> --values '{"fullName":"Ada Lovelace"}' --wait
```

Reuse shipping details with a buyer profile:

```sh
agent-commerce buyer-profile create --json-file profile.json
agent-commerce checkout create ... --buyer-profile <id>
```

## Flow 3: reveal a card number

For merchants that Agent Checkouts cannot reach.

```sh
agent-commerce agent-card reveal <id> --amount 25
```

Prints the number, expiry, and CVC. When the response says `enforced: no`, the network does not cap the amount. Prefer `agent-commerce checkout create` in that case.

Never paste a revealed card number into chat, logs, or files.

## Output and exit codes

Every command accepts `--json`. Errors go to stderr.

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | ok                                                     |
| 1    | error                                                  |
| 2    | needs the user: an approval URL or a checkout question |
| 3    | not logged in                                          |

## Config

`~/.config/agent-commerce/config.json` (or `$XDG_CONFIG_HOME/agent-commerce/`, or `$AGENT_COMMERCE_CONFIG_DIR`):

```json
{
  "apiBaseUrl": "https://wallet.example.com/api/agent-commerce",
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": "2026-01-01T00:00:00.000Z",
  "tokenEndpoint": "https://test.stytch.com/v1/public/<projectId>/oauth2/token",
  "clientId": "connected-app-...",
  "userId": "user-test-...",
  "email": "you@example.com"
}
```

Access tokens refresh on their own when they are within 60 seconds of expiry.

## Agent skill

The `skills/agent-commerce` folder in the repo teaches Claude Code and similar agents how to use this CLI. See its README.
