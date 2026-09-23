import { CrossmintApiError, type BrowserProfile, type CheckoutContext } from "@agent-commerce/core";
import type { Ctx } from "./context.js";

/**
 * Sticky browser sessions.
 *
 * Every checkout otherwise starts in a fresh browser, signed out, so a store
 * that wants an account asks the user to log in on every purchase. A browser
 * profile keeps the state from that first login and loads it into later runs,
 * which is what saved addresses, member pricing and one-click carts need.
 *
 * Crossmint gives a user at most one profile, so this is a get-or-create
 * rather than anything the caller has to manage: the server resolves it and
 * attaches it to each run. What the profile holds stays opaque — the API
 * returns metadata only, never cookies or tokens, and none of it reaches a
 * model or this server.
 */

/** The label a profile gets when this server makes one. */
const LABEL = "Merchant logins";

/**
 * Resolved ids, by user, kept on the context rather than in this module: one
 * map per server, so two servers in one process never read each other's. The
 * profile is durable at Crossmint; this only saves a round trip per checkout,
 * and holds ids, nothing more.
 */
export type BrowserProfileCache = Map<string, string>;

/**
 * The user's profile id for a checkout, making one the first time.
 *
 * Failure is deliberately quiet: a sticky session is a convenience, and a
 * purchase must not fall over because the convenience is unavailable. The run
 * goes ahead in a fresh browser, which is where every run started before.
 */
export async function stickyBrowserProfileId(
  ctx: Ctx,
  cctx: CheckoutContext,
  userId: string,
): Promise<string | undefined> {
  const cached = ctx.browserProfiles.get(userId);
  if (cached) return cached;

  try {
    const existing = await firstProfile(ctx, cctx);
    if (existing) return remember(ctx, userId, existing.id);
    const made = await ctx.crossmint.checkouts.createBrowserProfile(cctx, { label: LABEL });
    return remember(ctx, userId, made.id);
  } catch (e) {
    /*
     * 409 is "the user already has one". Two runs starting together can both
     * read no profile and both try to make it; the loser reads back what the
     * winner made rather than failing the checkout.
     */
    if (e instanceof CrossmintApiError && e.status === 409) {
      const existing = await firstProfile(ctx, cctx).catch(() => undefined);
      if (existing) return remember(ctx, userId, existing.id);
    }
    console.warn(
      "[agent-commerce] could not resolve a browser profile; this checkout starts signed out",
      e instanceof Error ? e.message : e,
    );
    return undefined;
  }
}

/**
 * The user's profile id, or undefined when they have none.
 *
 * Reading and deleting use this rather than the get-or-create above: asking
 * what is saved, or asking to forget it, is no reason to start saving.
 */
export async function findBrowserProfileId(
  ctx: Ctx,
  cctx: CheckoutContext,
  userId: string,
): Promise<string | undefined> {
  const cached = ctx.browserProfiles.get(userId);
  if (cached) return cached;
  const existing = await firstProfile(ctx, cctx);
  return existing ? remember(ctx, userId, existing.id) : undefined;
}

/** Forget a deleted profile, so the next checkout makes a fresh one. */
export function forgetBrowserProfile(ctx: Ctx, userId: string): void {
  ctx.browserProfiles.delete(userId);
}

/** The user's profile, or undefined. At most one exists, so one page is all of them. */
async function firstProfile(ctx: Ctx, cctx: CheckoutContext): Promise<BrowserProfile | undefined> {
  const list = await ctx.crossmint.checkouts.listBrowserProfiles(cctx, { limit: 1 });
  return list.data?.[0];
}

function remember(ctx: Ctx, userId: string, profileId: string): string {
  ctx.browserProfiles.set(userId, profileId);
  return profileId;
}
