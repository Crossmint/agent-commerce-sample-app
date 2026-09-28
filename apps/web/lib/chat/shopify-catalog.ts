import { serverEnv } from "@/lib/env";

/**
 * Product search across every Shopify store, through Shopify's Global
 * Catalog (UCP over MCP). The chat agent uses it when the user wants
 * something but has no link: it finds a few candidates, the user picks one,
 * and Agent Checkouts buys it at the product's own URL.
 *
 * No key is needed. Shopify reads the agent's UCP profile from the URL sent
 * with each call, so the profile must be reachable from the internet: this
 * deployment serves its own at /ucp/agent-profile.json. A local server is not
 * reachable, so it borrows Shopify's example profile instead.
 */

const ENDPOINT = "https://catalog.shopify.com/api/ucp/mcp";
const EXAMPLE_PROFILE =
  "https://shopify.dev/ucp/agent-profiles/2026-08-25/valid-with-capabilities.json";
const TIMEOUT_MS = 10_000;

function profileUrl(): string {
  const set = serverEnv.optional("UCP_AGENT_PROFILE_URL");
  if (set) return set;
  const base = serverEnv.webBaseUrl();
  const reachable = base.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(base);
  return reachable ? `${base}/ucp/agent-profile.json` : EXAMPLE_PROFILE;
}

/** One product, cut down to what the agent needs to offer it and buy it. */
export interface FoundProduct {
  title: string;
  /** "5.99 USD", the cheapest in-stock variant. */
  price?: string;
  store: string;
  /** The product page on the store's own site: what create_checkout starts from. */
  url: string;
  /** "4.7 of 5, 19107 reviews" */
  rating?: string;
  /** "Size: 1lb, 3lb, 5lb" */
  options?: string[];
  /** The product's main picture, on Shopify's CDN. */
  image?: string;
  /** The store's own words about it, cut short, for the details sheet. */
  description?: string;
}

interface Money {
  amount: number;
  currency: string;
}

interface CatalogMedia {
  type?: string;
  url?: string;
}

interface CatalogVariant {
  url?: string;
  media?: CatalogMedia[];
  price?: Money;
  availability?: { available?: boolean };
  seller?: { name?: string; url?: string };
}

interface CatalogProduct {
  title?: string;
  description?: { plain?: string };
  media?: CatalogMedia[];
  rating?: { value?: number; scale_max?: number; count?: number };
  price_range?: { min?: Money };
  options?: Array<{ name?: string; values?: Array<{ label?: string }> }>;
  variants?: CatalogVariant[];
}

export async function searchProducts(opts: {
  query: string;
  /** Most the buyer wants to pay, in major units of the currency. */
  maxPrice?: number;
  /** ISO 3166-1 alpha-2. Default US. */
  shipsTo?: string;
  limit?: number;
}): Promise<FoundProduct[]> {
  return call("search_catalog", {
    query: opts.query,
    filters: {
      available: true,
      ships_to: { country: (opts.shipsTo ?? "US").toUpperCase() },
      ...(opts.maxPrice ? { price: { max: Math.round(opts.maxPrice * 100) } } : {}),
    },
    pagination: { limit: Math.min(Math.max(opts.limit ?? 5, 1), 10) },
  });
}

/** Products by their page URLs, as the store's own site has them. Unknown URLs are left out. */
export async function lookUpProducts(urls: string[]): Promise<FoundProduct[]> {
  return call("lookup_catalog", { ids: urls.slice(0, 10) });
}

async function call(tool: string, catalog: Record<string, unknown>): Promise<FoundProduct[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      id: 1,
      params: {
        name: tool,
        arguments: { meta: { "ucp-agent": { profile: profileUrl() } }, catalog },
      },
    }),
  });
  if (!res.ok) throw new Error(`The product search failed (${res.status}).`);
  const body = (await res.json()) as {
    result?: { structuredContent?: { products?: CatalogProduct[] } };
    error?: { message?: string };
  };
  if (body.error) throw new Error(body.error.message ?? "The product search failed.");
  return (body.result?.structuredContent?.products ?? [])
    .map(toFound)
    .filter((p): p is FoundProduct => Boolean(p));
}

function toFound(p: CatalogProduct): FoundProduct | undefined {
  const variants = p.variants ?? [];
  const inStock = variants.filter((v) => v.availability?.available !== false && v.url);
  const cheapest = [...inStock].sort(
    (a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity),
  )[0];
  if (!cheapest?.url || !p.title) return undefined;
  const money = cheapest.price ?? p.price_range?.min;
  const image = [...(p.media ?? []), ...(cheapest.media ?? [])].find(
    (m) => (m.type ?? "image") === "image" && m.url,
  )?.url;
  const about = p.description?.plain?.replace(/\s+/g, " ").trim();
  return {
    title: p.title,
    ...(image ? { image: sized(image) } : {}),
    ...(about
      ? {
          description:
            about.length > 280 ? `${about.slice(0, 277).replace(/\s+\S*$/, "")}…` : about,
        }
      : {}),
    ...(money ? { price: `${(money.amount / 100).toFixed(2)} ${money.currency}` } : {}),
    store: cheapest.seller?.name ?? hostOf(cheapest.url),
    url: cleanUrl(cheapest.url),
    ...(p.rating?.value
      ? {
          rating: `${p.rating.value} of ${p.rating.scale_max ?? 5}${p.rating.count ? `, ${p.rating.count} reviews` : ""}`,
        }
      : {}),
    ...(p.options?.length
      ? {
          options: p.options.slice(0, 3).map(
            (o) =>
              `${o.name}: ${(o.values ?? [])
                .map((v) => v.label)
                .filter(Boolean)
                .slice(0, 6)
                .join(", ")}`,
          ),
        }
      : {}),
  };
}

/**
 * A card-sized picture. Shopify's CDN resizes on `width`, and store pictures
 * can be huge: IQBAR's main one is a 12 MB PNG, 200 KB at this size.
 */
function sized(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.hostname !== "cdn.shopify.com" && !url.pathname.includes("/cdn/shop/")) return raw;
    url.searchParams.set("width", "400");
    return url.toString();
  } catch {
    return raw;
  }
}

/** The product page without the catalog's tracking parameters; the variant stays. */
function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "_gsid") url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}
