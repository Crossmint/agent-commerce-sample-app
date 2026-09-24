---
"@agent-commerce/server": minor
"@agent-commerce/core": patch
"@agent-commerce/mcp": patch
"@agent-commerce/cli": patch
"@agent-commerce/ui": patch
---

A checkout carries a short purpose for its payment step.

`POST /v1/checkouts` takes `purpose`, what the purchase is in a few words ("Blue Pikachu erasable pen"). The server keeps it with the checkout (a new nullable `purpose` column on `checkouts`, migration 0004) and makes it the description of the agent card it raises at the payment step, so the approval screen shows it. Without one the description reads "Purchase at" and the store; it is never the run's task any more. The chat agent always writes one; the MCP tool takes `purpose`, and the CLI `--purpose`.
