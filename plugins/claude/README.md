# Agent Commerce plugin for Claude Code

Gives Claude Code a way to pay with the user's own card, with the user's approval.

What it installs:

- **MCP server** `agent-commerce` at `https://agent-commerce.demos-crossmint.com/api/mcp`. Claude Code signs the user in through OAuth on first use (`/mcp`, then Authenticate). The user sees Agent Commerce's consent screen, then approves each budget on the wallet.
- **Skill** `agent-commerce`: when to request an agent card, how to show the approval link, why checkouts beat raw card numbers.

## Install

```
/plugin marketplace add Crossmint/agent-commerce-sample-app
/plugin install agent-commerce@agent-commerce
```

## Point it at your own wallet

Change the URL in `.mcp.json` to your deployment's `/api/mcp`, or run the server over stdio with the CLI login:

```json
{
  "mcpServers": {
    "agent-commerce": {
      "command": "npx",
      "args": ["-y", "@agent-commerce/mcp", "--api", "https://your-wallet.example.com/api/agent-commerce"]
    }
  }
}
```

## Keep the skill in sync

`skills/agent-commerce/SKILL.md` here is a copy of the one at the repo root. Run `pnpm plugin:sync` after editing the original.
