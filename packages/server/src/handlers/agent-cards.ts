import { withAgentRails } from "@agent-commerce/core";
import { parseBody, requireUser, type Ctx } from "../context.js";
import { mintFromAgentCard } from "../credentials.js";
import { json, noContent } from "../errors.js";
import type { Params } from "../router.js";
import { credentialsSchema } from "../schemas.js";

/** GET /v1/agent-cards */
export async function listAgentCards(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const agentCards = await ctx.crossmint.orderIntents.list({ jwt: user.jwt });
  return json({ agentCards: agentCards.map(withAgentRails) });
}

/** GET /v1/agent-cards/:id */
export async function getAgentCard(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const agentCard = await ctx.crossmint.orderIntents.get({ jwt: user.jwt }, params.id!);
  return json(withAgentRails(agentCard));
}

/** DELETE /v1/agent-cards/:id */
export async function revokeAgentCard(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  await ctx.crossmint.orderIntents.revoke({ jwt: user.jwt }, params.id!);
  return noContent();
}

/** POST /v1/agent-cards/:id/credentials */
export async function mintCredentials(req: Request, ctx: Ctx, params: Params): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, credentialsSchema);
  const { response } = await mintFromAgentCard(ctx, user, params.id!, {
    amount: body.amount,
    merchant: body.merchant,
    format: body.format,
  });
  return json(response);
}
