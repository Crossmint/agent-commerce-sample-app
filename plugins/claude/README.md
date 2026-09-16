# GOAT plugin for Claude Code

Gives Claude Code a way to pay with the user's own card, with the user's approval.

What it installs:

- **MCP server** `goat` at `https://goat-jade.vercel.app/api/mcp`. Claude Code signs the user in through OAuth on first use (`/mcp`, then Authenticate). The user sees GOAT's consent screen, then approves each budget on the wallet.
- **Skill** `goat`: when to request an agent card, how to show the approval link, why checkouts beat raw card numbers.

## Install

```
/plugin marketplace add Crossmint/goat
/plugin install goat@goat
```

## Point it at your own wallet

Change the URL in `.mcp.json` to your deployment's `/api/mcp`, or run the server over stdio with the CLI login:

```json
{
  "mcpServers": {
    "goat": {
      "command": "npx",
      "args": ["-y", "@goat-wallet/mcp", "--api", "https://your-wallet.example.com/api/goat"]
    }
  }
}
```

## Keep the skill in sync

`skills/goat/SKILL.md` here is a copy of the one at the repo root. Run `pnpm plugin:sync` after editing the original.
