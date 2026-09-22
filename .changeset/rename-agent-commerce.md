---
"@agent-commerce/core": major
"@agent-commerce/server": major
"@agent-commerce/ui": major
"@agent-commerce/auth": major
"@agent-commerce/mcp": major
"@agent-commerce/cli": major
---

The project is now the Agent Commerce Sample App: a sample app by Crossmint that shows agentic commerce. It is not a brand, so the old product name is gone from every package.

**Breaking.** The npm scope is `@agent-commerce/*`. Exported identifiers that carried the old name are renamed `Goat*` to `AgentCommerce*`: `createAgentCommerceHandlers`, `AgentCommerceProvider`, `useAgentCommerce`, `createAgentCommerceApi`, `AgentCommerceApiError`, `AgentCommerceConfig`, and the rest. Environment variables are `AGENT_COMMERCE_*` (`AGENT_COMMERCE_WEB_BASE_URL`, `AGENT_COMMERCE_ENCRYPTED_CARD_PRIVATE_KEY`, `AGENT_COMMERCE_API_URL`). The HTTP API mounts at `/api/agent-commerce`. The CLI is `@agent-commerce/cli` with the bin `agent-commerce`, and it keeps its config in `~/.config/agent-commerce/config.json`. The MCP server announces itself as `agent-commerce`. The skill lives at `skills/agent-commerce`.

**New design.** The whole site, the components in `@agent-commerce/ui` and the CLI's browser callback page follow the Crossmint onramp sample app: a white ground with a dot grid, `#4564FF` as the one accent, system sans for text and Mona Sans for money figures only, 28px medium step headings, summary lists with hairline rows, tall 16px-radius calls to action (`Button size="xl"`), and bottom sheets with 32px top corners. The approval screen ends on the approved limit as a big blue figure rather than a green disc. The pixel wordmark, the green accent, the hairline grid and the halftone textures are retired; the site carries the Crossmint logotype.
