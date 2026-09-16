# Logo sources

Files in this folder are served from `/logos/...`. Nothing here is hotlinked.
Agent marks for the "Try a live implementation" tiles are white (`#ffffff`) on transparent so they sit on dark tiles. The three real-brand marks (Instinct, Muse, Grok icon) keep their own colors.

| File | Brand | Source | Notes |
| --- | --- | --- | --- |
| `crossmint-white.svg`, `crossmint-gradient.svg`, `crossmint-mark-white.svg` | Crossmint | Crossmint brand kit (copied by hand) | Do not recolor or distort. |
| `claude.svg` | Claude (Anthropic) | `https://cdn.simpleicons.org/claude/ffffff` | Simple Icons, white variant. |
| `claude-code.svg` | Claude Code | `https://cdn.simpleicons.org/claudecode/ffffff` | Simple Icons, white variant. |
| `openai.svg` | ChatGPT (OpenAI) | `https://raw.githubusercontent.com/openai/openai-realtime-console/main/client/assets/openai-logomark.svg` | Official OpenAI logomark from an OpenAI GitHub repo. `openai.com/brand` returns 403 to non-browser clients and Simple Icons no longer ships `openai`. Fill set to white. |
| `grok.svg` | Grok (xAI) | `https://grok.com/images/favicon.svg` | Official Grok favicon. Only the two glyph paths were kept; the rounded tile, blur filter and outline stroke were removed and the viewBox was fit to the glyph. `x.ai` returns 403 to non-browser clients and Simple Icons has no `grok` or `xai` slug. |
| `openclaw.svg` | OpenClaw | `https://raw.githubusercontent.com/openclaw/openclaw/main/apps/linux/src-tauri/icons/tray-template.svg` | Official monochrome tray icon from the OpenClaw repo. Fill changed from black to white, comments stripped. |
| `instinct.svg`, `instinct-icon.png` | Instinct (Spear Street Technology) | `https://instinct.co/favicon.svg`, `https://instinct.co/apple-touch-icon.png` | Official mark: a dark (#060A09) "I" glyph on a white rounded tile. Full app icon, so avatars show it edge to edge. Site theme color #0d0d0d. |
| `muse-squiggle.svg` | Muse (Meta) | `https://muse.ai/landing/brand/muse-logo.svg` (byte-identical to `https://muse.ai/images/favicon/app-squiggle.svg`, their favicon) | The current Muse mark, Sept 2026: the blue squiggle "M" by Jessica Hische, gradient #0082FB → #0064E0 → #0040DC. muse.ai blocks non-browser clients; fetched through a real browser. |
| `muse.svg` | Muse (Meta) | Composed here from `muse-squiggle.svg` after `https://muse.ai/landing/placeholders/sizzle.png` ("The Muse app icon") | The Muse app icon: the squiggle centered on a white rounded tile with a faint gray gradient. Used for avatars and the selector pill. |
| `grok-icon.png` | Grok (SpaceXAI) | `https://grok.com/images/apple-touch-icon.png` | Official app icon: white glyph on a black rounded tile. Re-fetched Sept 2026, byte-identical. Used for the GrokBot avatar. |
| `grok-wordmark.svg` | Grok (SpaceXAI) | The inline header SVG on `https://grok.com` (88×33: mark + "Grok" letters) | Fill set to Grok's ink #050505 so it works as an image on the light approval page. grok.com light theme: background #f9f8f7, text #050505, filled buttons #050505. |
| `hermes.svg` | Hermes (Nous Research) | Drawn here. **Placeholder.** | No official vector mark was obtainable: `nousresearch.com` has no logo image, its `safari-pinned-tab.svg` is a traced mascot illustration, the `hermes-agent` favicon is a text glyph, and Simple Icons has no `nousresearch` slug. Replace with an official mark when available. |

`/brand/mark.png` (the GOAT example agent tile) lives in `public/brand/`.
