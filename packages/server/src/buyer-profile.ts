import type { BuyerProfile, CheckoutContext } from "@agent-commerce/core";
import type { Ctx } from "./context.js";

/**
 * Saved buyer details.
 *
 * A store asks for the buyer's name, email and shipping address on every
 * checkout. A buyer profile holds them, and a run that starts with one fills
 * those fields itself instead of asking. The user saves their details once,
 * the first time a store asks; after that the server attaches the profile to
 * every run, and nobody has to type an address again.
 *
 * A user can hold several profiles. The one that counts is the newest: saving
 * again is how a user moves house.
 */

/**
 * The profile in use, by user, kept on the context rather than in this
 * module, as for browser profiles. The profile is durable at Crossmint; this
 * saves a round trip per checkout and per chat turn.
 */
export type BuyerProfileCache = Map<string, BuyerProfile>;

/**
 * The user's buyer profile, or undefined when they have saved none.
 *
 * Failure is quiet, like the browser profile's: saved details are a
 * convenience, and a purchase must not fall over for want of them. The run
 * goes ahead without, and the store asks.
 */
export async function currentBuyerProfile(
  ctx: Ctx,
  cctx: CheckoutContext,
  userId: string,
): Promise<BuyerProfile | undefined> {
  const cached = ctx.buyerProfiles.get(userId);
  if (cached) return cached;
  try {
    const list = await ctx.crossmint.checkouts.listBuyerProfiles(cctx, { limit: 100 });
    const newest = newestOf(list.data ?? []);
    if (newest) ctx.buyerProfiles.set(userId, newest);
    return newest;
  } catch (e) {
    console.warn(
      "[agent-commerce] could not read the buyer profile; this checkout asks for the details",
      e instanceof Error ? e.message : e,
    );
    return undefined;
  }
}

/** A profile just saved is the one to use from now on. */
export function rememberBuyerProfile(ctx: Ctx, userId: string, profile: BuyerProfile): void {
  ctx.buyerProfiles.set(userId, profile);
}

/**
 * The newest profile by its timestamps. Without timestamps, the last one
 * listed, on the guess that the list runs oldest first.
 */
function newestOf(profiles: BuyerProfile[]): BuyerProfile | undefined {
  const stamp = (p: BuyerProfile) => Date.parse(p.updatedAt ?? p.createdAt ?? "") || 0;
  if (profiles.some((p) => stamp(p) > 0)) {
    return [...profiles].sort((a, b) => stamp(b) - stamp(a))[0];
  }
  return profiles.at(-1);
}
