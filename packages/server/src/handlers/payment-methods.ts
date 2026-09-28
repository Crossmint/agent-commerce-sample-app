import { parseBody, requireUser, resolveEmail, type Ctx } from "../context.js";
import { json, noContent } from "../errors.js";
import type { Params } from "../router.js";
import { registerCardSchema } from "../schemas.js";

/** GET /v1/payment-methods */
export async function listPaymentMethods(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const result = await ctx.crossmint.paymentMethods.list({ jwt: user.jwt });
  return json({ paymentMethods: result.paymentMethods });
}

/** POST /v1/payment-methods/:id/register */
export async function registerPaymentMethod(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  const body = await parseBody(req, registerCardSchema);
  const email = await resolveEmail(user, ctx, body.email);
  const result = await ctx.crossmint.paymentMethods.registerForOrderIntents(
    { jwt: user.jwt },
    params.id!,
    { email, countryCode: body.countryCode, languageCode: body.languageCode },
  );
  return json(result);
}

/** DELETE /v1/payment-methods/:id */
export async function deletePaymentMethod(
  req: Request,
  ctx: Ctx,
  params: Params,
): Promise<Response> {
  const user = await requireUser(req, ctx);
  await ctx.crossmint.paymentMethods.delete({ jwt: user.jwt }, params.id!);
  return noContent();
}
