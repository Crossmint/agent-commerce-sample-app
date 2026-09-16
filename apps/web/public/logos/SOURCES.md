# Logo sources

Files in this folder are served from `/logos/...`. Nothing here is hotlinked.
Agent marks are white (`#ffffff`) on transparent so they sit on dark tiles.

| File | Brand | Source | Notes |
| --- | --- | --- | --- |
| `crossmint-white.svg`, `crossmint-gradient.svg`, `crossmint-mark-white.svg` | Crossmint | Crossmint brand kit (copied by hand) | Do not recolor or distort. |
| `claude.svg` | Claude (Anthropic) | `https://cdn.simpleicons.org/claude/ffffff` | Simple Icons, white variant. |
| `claude-code.svg` | Claude Code | `https://cdn.simpleicons.org/claudecode/ffffff` | Simple Icons, white variant. |
| `openai.svg` | ChatGPT (OpenAI) | `https://raw.githubusercontent.com/openai/openai-realtime-console/main/client/assets/openai-logomark.svg` | Official OpenAI logomark from an OpenAI GitHub repo. `openai.com/brand` returns 403 to non-browser clients and Simple Icons no longer ships `openai`. Fill set to white. |
| `grok.svg` | Grok (xAI) | `https://grok.com/images/favicon.svg` | Official Grok favicon. Only the two glyph paths were kept; the rounded tile, blur filter and outline stroke were removed and the viewBox was fit to the glyph. `x.ai` returns 403 to non-browser clients and Simple Icons has no `grok` or `xai` slug. |
| `openclaw.svg` | OpenClaw | `https://raw.githubusercontent.com/openclaw/openclaw/main/apps/linux/src-tauri/icons/tray-template.svg` | Official monochrome tray icon from the OpenClaw repo. Fill changed from black to white, comments stripped. |
| `hermes.svg` | Hermes (Nous Research) | Drawn here. **Placeholder.** | No official vector mark was obtainable: `nousresearch.com` has no logo image, its `safari-pinned-tab.svg` is a traced mascot illustration, the `hermes-agent` favicon is a text glyph, and Simple Icons has no `nousresearch` slug. Replace with an official mark when available. |

`/brand/mark.png` (the GOAT example agent tile) lives in `public/brand/`.
