import { lookupEmail, requireUser, type Ctx } from "../context.js";
import { json } from "../errors.js";

/** GET /v1/me */
export async function getMe(req: Request, ctx: Ctx): Promise<Response> {
  const user = await requireUser(req, ctx);
  const email = user.email ?? (await lookupEmail(user.userId, ctx));
  return json({ userId: user.userId, email });
}
