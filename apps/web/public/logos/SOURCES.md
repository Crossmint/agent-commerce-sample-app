# Logo sources

Files in this folder are served from `/logos/...`. Nothing here is hotlinked.
Agent marks for the "Try a live implementation" tiles fill with `currentColor` on transparent and render as CSS masks (`components/landing/mask-logo.tsx`), so they take the page's navy text color on the white tiles. The three example agents in the brand switcher (Impulse, Lumen, BotBot) are not real companies: their marks are original Agent Commerce art, drawn here, and keep their own colors.

| File | Brand | Source | Notes |
| --- | --- | --- | --- |
| `crossmint-white.svg`, `crossmint-gradient.svg`, `crossmint-mark-white.svg` | Crossmint | Crossmint brand kit (copied by hand) | Do not recolor or distort. |
| `claude.svg` | Claude (Anthropic) | `https://cdn.simpleicons.org/claude/ffffff` | Simple Icons, white variant; fill changed to `currentColor`. |
| `claude-code.svg` | Claude Code | `https://cdn.simpleicons.org/claudecode/ffffff` | Simple Icons, white variant; fill changed to `currentColor`. |
| `openai.svg` | ChatGPT (OpenAI) | `https://raw.githubusercontent.com/openai/openai-realtime-console/main/client/assets/openai-logomark.svg` | Official OpenAI logomark from an OpenAI GitHub repo. `openai.com/brand` returns 403 to non-browser clients and Simple Icons no longer ships `openai`. Fill set to `currentColor`. |
| `grok.svg` | Grok (xAI) | `https://grok.com/images/favicon.svg` | Official Grok favicon. Only the two glyph paths were kept; the rounded tile, blur filter and outline stroke were removed and the viewBox was fit to the glyph. `x.ai` returns 403 to non-browser clients and Simple Icons has no `grok` or `xai` slug. |
| `openclaw.svg` | OpenClaw | `https://raw.githubusercontent.com/openclaw/openclaw/main/apps/linux/src-tauri/icons/tray-template.svg` | Official monochrome tray icon from the OpenClaw repo. Fill changed from black to `currentColor`, comments stripped. |
| `impulse.svg` | Impulse (example agent) | Drawn here. **Original Agent Commerce mark.** | A dark (#141414) rounded tile with a white bolt. Full app icon, so avatars show it edge to edge. Not a real company. |
| `lumen.svg` | Lumen (example agent) | Drawn here. **Original Agent Commerce mark.** | A blue-to-violet gradient circle (#38bdf8 → #4f7cf5 → #8b5cf6) with a white four-point spark. Used for the avatar, the selector pill, and the approval header. Not a real company. |
| `botbot.svg` | BotBot (example agent) | Drawn here. **Original Agent Commerce mark.** | A black (#0a0a0a) rounded square with two round white eyes and a small antenna. Full app icon. Used for the avatar, the selector pill, and the approval header wordmark. Not a real company. |
| `acme.svg` | Acme Agent (the template's own stand-in) | Drawn here. **Original Agent Commerce mark.** | An indigo (#2f3a8f) rounded tile with a white geometric A. Full app icon. It stands in for whoever builds on the template, so the hero flow reads as someone else's product rather than as Crossmint's. Not a real company. |
| `imessage.svg`, `whatsapp.svg`, `instagram.svg` | Apple iMessage, WhatsApp, Instagram | `https://cdn.simpleicons.org/imessage`, `.../whatsapp`, `.../instagram` | Simple Icons glyphs, each in the brand's own color as Simple Icons records it (#34DA50, #25D366, #FF0069). Kept in color, not recolored to `currentColor`: they name a third-party app in the platform menu on `/app`, where the point is to recognise the app. |
| `starbucks.svg` | Starbucks | `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/starbucks.svg` (the file behind `https://cdn.simpleicons.org/starbucks/ffffff`) | Simple Icons siren glyph, fill set to white. Only in the receipt card's merchant tile, white on Starbucks green #00704A. |
| `hermes.svg` | Hermes (Nous Research) | Drawn here. **Placeholder.** | No official vector mark was obtainable: `nousresearch.com` has no logo image, its `safari-pinned-tab.svg` is a traced mascot illustration, the `hermes-agent` favicon is a text glyph, and Simple Icons has no `nousresearch` slug. Replace with an official mark when available. |

The three example agents in the brand switcher show what a customer's own brand looks like; `acme.svg` does the same job for the hero and the core-piece mocks, which have no switcher to make the point for them. The site's own identity is Crossmint's: the logotype at `/crossmint.svg` and the mark at `/crossmint-mark.svg`, both from the Crossmint brand kit.

## Powered-by strip
All six fill with `currentColor` and render as CSS masks (`components/landing/mask-logo.tsx`), so the page colors them with its `--muted-foreground` token.
- visa.svg, mastercard.svg, basis-theory.svg, crossmint-gray.svg: logotypes from lobster.cash (Crossmint's own site); the original gray #959AA4 fills changed to `currentColor`. The `white` fills inside `<mask>` elements are luminance masks and stay white.
- adyen.svg: inline header SVG from adyen.com, fill set to `currentColor`.
- vercel.svg: Wikimedia Commons "Vercel logo 2025" (triangle + wordmark), fill set to `currentColor`.
- `grok-bot.svg`: Grok Bot mark from https://x.ai/bot (the `.grok-bot-mark--fill` SVG in the page), head and eyes merged into one even-odd path so the eyes are holes and the mark takes `currentColor`. Fetched 2026-09-19.
- `eve.svg`: eve logotype from https://eve.dev (header SVG), `currentColor`. Fetched 2026-09-19.
- `cursor.svg`: the Cursor mark from the cursor.com header lockup (first path of the logo SVG), `currentColor`. Fetched 2026-09-19.
- `hermes-agent.png`: Hermes Agent icon from https://cdn.jsdelivr.net/gh/selfhst/icons/png/hermes-agent.png (selfh.st icons). Black on transparent, so it renders as a mask in the text color. Fetched 2026-09-19.
