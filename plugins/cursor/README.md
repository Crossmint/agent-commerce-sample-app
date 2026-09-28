# Agent Commerce plugin for Cursor

Gives the agent in Cursor a way to pay with the user's own card, with the user's approval.

What it installs:

- **MCP server** `agent-commerce`, pointed at the hosted Agent Commerce wallet at `https://agent-commerce.demos-crossmint.com/api/mcp`. Cursor signs the user in through OAuth on first use. The user sees Agent Commerce's consent screen, then approves each budget on the wallet.
- **Skill** `agent-commerce`: when to request an agent card, how to show the approval link, why checkouts beat raw card numbers.
- **Rule** `agent-commerce-payments`: the short version, applied whenever a task involves buying or paying.

## Install

From the Cursor Marketplace, once listed. Until then, add this repository as a plugin source:

```
https://github.com/Crossmint/agent-commerce-sample-app
```

## Point it at your own wallet

If you deploy the Agent Commerce template yourself, change the URL in `mcp.json` to your deployment's `/api/mcp`.

## Keep the skill in sync

`skills/agent-commerce/SKILL.md` here is a copy of `skills/agent-commerce/SKILL.md` at the repo root. Run `pnpm plugin:sync` after editing the original.

## Grok Bot

Grok Bot reads the same plugin layout. Install this folder the same way, or connect the MCP URL directly in its connector settings.
