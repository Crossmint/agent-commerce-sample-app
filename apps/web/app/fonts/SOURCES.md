# Font sources

Files in this folder are self-hosted with `next/font/local` from `app/layout.tsx`.

| File | Family | Source | License |
| --- | --- | --- | --- |
| `vcr-osd-mono.woff2` | VCR OSD Mono, Regular, version 1.001 (March 31, 2015) | `https://dl.dafont.com/dl/?f=vcr_osd_mono` (the TTF `VCR_OSD_MONO_1.001.ttf` inside the zip), converted to woff2 with the `ttf2woff2` npm package. | The font's name table names the designer as MrManet (Riciery Leal) and carries no license string. Dafont lists the font as "100% Free", the author's terms for personal and commercial use. Keep this note with the file. |

## Where it is used

VCR OSD Mono is the GOAT wordmark: the text "GOAT" in uppercase, letter-spacing −0.01em, color `#32d55d` on light grounds (navy `#0a1825` inside green areas). It matches the pixel type of the Crossmint "agents" lockup. It is exposed as `--font-pixel` and the `font-pixel` utility. Body text uses Geist; display type uses Plus Jakarta Sans from Google Fonts via `next/font/google`.

`public/brand/goat-wordmark.svg` is the same word as glyph outlines (opentype.js `font.getPath("GOAT", 0, 0, 200).toSVG()`), for places that cannot load the web font.
