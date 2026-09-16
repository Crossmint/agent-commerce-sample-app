# GOAT plugin for Cursor

Gives the agent in Cursor a way to pay with the user's own card, with the user's approval.

What it installs:

- **MCP server** `goat`, pointed at the hosted GOAT wallet at `https://goat-jade.vercel.app/api/mcp`. Cursor signs the user in through OAuth on first use. The user sees GOAT's consent screen, then approves each budget on the wallet.
- **Skill** `goat`: when to request an agent card, how to show the approval link, why checkouts beat raw card numbers.
- **Rule** `goat-payments`: the short version, applied whenever a task involves buying or paying.

## Install

From the Cursor Marketplace, once listed. Until then, add this repository as a plugin source:

```
https://github.com/Crossmint/goat
```

## Point it at your own wallet

If you deploy the GOAT template yourself, change the URL in `mcp.json` to your deployment's `/api/mcp`. Or run the MCP server locally over stdio, logged in with the CLI:

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

`skills/goat/SKILL.md` here is a copy of `skills/goat/SKILL.md` at the repo root. Run `pnpm plugin:sync` after editing the original.

## Grok Bot

Grok Bot reads the same plugin layout. Install this folder the same way, or connect the MCP URL directly in its connector settings.
