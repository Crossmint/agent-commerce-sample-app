/**
 * GET /api/favicon?host=smartsweets.com: a website's icon, for the card the
 * chat shows when the agent starts a checkout there.
 *
 * Fetched here rather than from a favicon service, so no third party learns
 * which stores a user shops at. Many stores serve nothing at /favicon.ico
 * (Shopify stores among them), so the home page's `<link rel="icon">` comes
 * first and /favicon.ico is the fallback. A miss is a 404, and the card
 * draws a globe.
 *
 * The route fetches URLs built from a query parameter, so it is strict about
 * them: a public domain name only (no IP address, no localhost, no port), at
 * most three redirects each checked the same way, short timeouts, small size
 * caps, and only images come back.
 */

const TIMEOUT_MS = 4000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 200 * 1024;
const MAX_REDIRECTS = 3;
const UA = "Mozilla/5.0 (compatible; AgentCommerceSampleApp/1.0; +favicon)";

const FOUND = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const MISSING = "public, max-age=3600, s-maxage=86400";

export async function GET(req: Request): Promise<Response> {
  const host = new URL(req.url).searchParams.get("host")?.trim().toLowerCase() ?? "";
  if (!isPublicHost(host)) return new Response("Bad host", { status: 400 });

  for (const candidate of await iconCandidates(host)) {
    const icon = await fetchIcon(candidate);
    if (icon) {
      return new Response(icon.body, {
        headers: {
          "Content-Type": icon.type,
          "Cache-Control": FOUND,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }
  return new Response("No icon", { status: 404, headers: { "Cache-Control": MISSING } });
}

/** A domain name that could be on the public internet: letters and dots, a real TLD. */
function isPublicHost(host: string): boolean {
  if (host.length > 253 || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return false;
  if (/^\d+(\.\d+)+$/.test(host)) return false; // an IPv4 address
  if (/\.(local|localhost|internal|lan|home|corp)$/.test(host)) return false;
  return /\.[a-z]{2,}$/.test(host);
}

/** The home page's icons, best first, then /favicon.ico. */
async function iconCandidates(host: string): Promise<string[]> {
  const fallback = `https://${host}/favicon.ico`;
  const page = await safeFetch(`https://${host}/`, "text/html");
  if (!page) return [fallback];
  const html = await readHead(page.res);
  const links = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .map((tag) => ({ rel: attr(tag, "rel")?.toLowerCase() ?? "", href: attr(tag, "href") }))
    .filter((l): l is { rel: string; href: string } => Boolean(l.href) && /\bicon\b/.test(l.rel));
  // A plain icon draws best at card size; the touch icon is a good second.
  const rank = (rel: string) => (rel.includes("apple-touch") ? 1 : rel.includes("mask") ? 3 : 0);
  const hrefs = links
    .sort((a, b) => rank(a.rel) - rank(b.rel))
    .map((l) => resolve(l.href, page.url))
    .filter((u): u is string => Boolean(u));
  return [...new Set([...hrefs, fallback])];
}

async function fetchIcon(url: string): Promise<{ body: ArrayBuffer; type: string } | undefined> {
  if (url.startsWith("data:image/")) return fromDataUrl(url);
  const got = await safeFetch(url, "image/*");
  if (!got) return undefined;
  const type = got.res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  // Some servers label a .ico as octet-stream.
  const image =
    type.startsWith("image/") || (type === "application/octet-stream" && /\.ico(\?|$)/.test(url));
  if (!image || type === "image/svg+xml") return undefined; // an SVG can carry script; skip it
  const body = await readCapped(got.res, MAX_ICON_BYTES);
  if (!body || body.byteLength === 0) return undefined;
  return { body, type: type.startsWith("image/") ? type : "image/x-icon" };
}

/** GET with a timeout, following at most a few redirects, each to a public https host. */
async function safeFetch(
  start: string,
  accept: string,
): Promise<{ res: Response; url: string } | undefined> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return undefined;
    }
    if (parsed.protocol !== "https:" || parsed.port || !isPublicHost(parsed.hostname))
      return undefined;
    let res: Response;
    try {
      res = await fetch(parsed, {
        redirect: "manual",
        headers: { Accept: accept, "User-Agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return undefined;
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return undefined;
      url = new URL(next, parsed).toString();
      continue;
    }
    return res.ok ? { res, url: parsed.toString() } : undefined;
  }
  return undefined;
}

/** The page up to `</head>`, where the icon links are, and never more than the cap. */
async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    while (bytes < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  return html;
}

async function readCapped(res: Response, cap: number): Promise<ArrayBuffer | undefined> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > cap) return undefined;
  const reader = res.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > cap) {
      void reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out.buffer;
}

function fromDataUrl(url: string): { body: ArrayBuffer; type: string } | undefined {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(url);
  if (!m || m[1] === "image/svg+xml") return undefined;
  const bytes = Buffer.from(m[2]!, "base64");
  if (bytes.byteLength > MAX_ICON_BYTES) return undefined;
  return { body: new Uint8Array(bytes).buffer, type: m[1]! };
}

/** One attribute of a tag, quoted or not. */
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4])?.trim() : undefined;
}

function resolve(href: string, base: string): string | undefined {
  if (href.startsWith("data:")) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}
