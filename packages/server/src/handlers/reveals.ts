import { requireUser, type Ctx } from "../context.js";
import { json } from "../errors.js";

/**
 * GET /v1/reveals
 *
 * Every credential this user's agents minted, newest first. The row holds what
 * was asked for and never what came back, so this is safe to show in a wallet
 * and safe to hand to an agent that can already mint.
 */
export async function listReveals(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const params = new URL(req.url).searchParams;
  const asked = Number(params.get("limit") ?? 100);
  const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), 500) : 100;
  const agentCardId = params.get("agentCardId") ?? undefined;
  const reveals = await ctx.reveals.listReveals(user.userId, { limit, agentCardId });
  return json({ reveals });
}
