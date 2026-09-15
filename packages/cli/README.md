# goat

The GOAT CLI. It lets an agent ask a user for a bounded agent card, then pay with it. The user approves in a browser. The agent never sees your Crossmint keys.

Works for humans too.

## Install

```sh
npm i -g goat
```

Node 20 or newer.

## Log in

```sh
goat login --api https://wallet.example.com/api/goat
```

The CLI reads `GET /v1/config` from that URL. It then runs an OAuth 2.1 PKCE login in your browser and stores the tokens in `~/.config/goat/config.json` (mode 0600).

No local browser? Use the paste flow:

```sh
goat login --code
```

It prints a URL. Open it anywhere, log in, and paste the code back.

For CI or an agent sandbox, skip login. Set `GOAT_API_URL` and `GOAT_TOKEN` instead.

Check the session with `goat whoami`. Remove it with `goat logout`.

## Flow 1: request an agent card

```sh
goat agent-card request --amount 50 --description "Flight to SF" --wait
```

The command prints an approval URL. Show it to the user. They pick a saved card and approve. With `--wait` the command blocks until the card is active, denied, or expired.

Lock the card to one merchant with `--merchant-name`, `--merchant-url`, and `--merchant-country`. Set the lifetime with `--expires-in-hours` (default 24).

Then:

```sh
goat agent-card list
goat agent-card get <id>
goat agent-card revoke <id>
goat agent-card status <requestId> --wait   # resume waiting on a request
```

## Flow 2: checkout at a URL (preferred)

Crossmint buys the item. It fills in the card itself. The card number never reaches the agent.

```sh
goat checkout create --url https://shop.example/p/1 --agent-card <id> --max-cost 100 --request "medium, black" --wait
```

If the shop asks a question (size, shipping address), the command prints the fields and exits with code 2. Answer it:

```sh
goat checkout answer <checkoutId> <actionId> --values '{"fullName":"Ada Lovelace"}' --wait
```

Reuse shipping details with a buyer profile:

```sh
goat buyer-profile create --json-file profile.json
goat checkout create ... --buyer-profile <id>
```

## Flow 3: reveal a card number

For merchants that Agent Checkouts cannot reach.

```sh
goat agent-card reveal <id> --amount 25
```

Prints the number, expiry, and CVC. When the response says `enforced: no`, the network does not cap the amount. Prefer `goat checkout create` in that case.

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

`~/.config/goat/config.json` (or `$XDG_CONFIG_HOME/goat/`, or `$GOAT_CONFIG_DIR`):

```json
{
  "apiBaseUrl": "https://wallet.example.com/api/goat",
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

The `skills/goat` folder in the repo teaches Claude Code and similar agents how to use this CLI. See its README.
