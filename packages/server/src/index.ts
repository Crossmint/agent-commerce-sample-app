import { createContext, type Ctx } from "./context.js";
import { toErrorResponse } from "./errors.js";
import {
  approveRequest,
  createRequest,
  denyRequest,
  getRequest,
  verifiedRequest,
} from "./handlers/agent-card-requests.js";
import {
  getAgentCard,
  listAgentCards,
  mintCredentials,
  revokeAgentCard,
} from "./handlers/agent-cards.js";
import {
  createBuyerProfile,
  createCheckout,
  getCheckout,
  submitCheckoutAction,
} from "./handlers/checkouts.js";
import { getConfig } from "./handlers/config.js";
import { getMe } from "./handlers/me.js";
import {
  deletePaymentMethod,
  listPaymentMethods,
  registerPaymentMethod,
} from "./handlers/payment-methods.js";
import { Router } from "./router.js";
import type { GoatServerConfig } from "./types.js";

export type { CheckoutView } from "./handlers/checkouts.js";
export { buildPublicConfig } from "./handlers/config.js";
export { HttpError, type ErrorCode } from "./errors.js";
export { routePath } from "./router.js";
export { memoryCheckoutStore, memoryRequestStore } from "./store/memory.js";
export * from "./types.js";

export type GoatHandler = (req: Request) => Promise<Response>;

export interface GoatHandlers {
  GET: GoatHandler;
  POST: GoatHandler;
  PUT: GoatHandler;
  DELETE: GoatHandler;
  /** Dispatches on `req.method`. */
  handler: GoatHandler;
}

/** Every route in docs/API.md, wired to its handler. */
export function buildRouter(): Router<Ctx> {
  return new Router<Ctx>()
    .get("/v1/config", getConfig)
    .get("/v1/me", getMe)
    .get("/v1/payment-methods", listPaymentMethods)
    .post("/v1/payment-methods/:id/register", registerPaymentMethod)
    .delete("/v1/payment-methods/:id", deletePaymentMethod)
    .post("/v1/agent-card-requests", createRequest)
    .get("/v1/agent-card-requests/:id", getRequest)
    .post("/v1/agent-card-requests/:id/approve", approveRequest)
    .post("/v1/agent-card-requests/:id/verified", verifiedRequest)
    .post("/v1/agent-card-requests/:id/deny", denyRequest)
    .get("/v1/agent-cards", listAgentCards)
    .get("/v1/agent-cards/:id", getAgentCard)
    .delete("/v1/agent-cards/:id", revokeAgentCard)
    .post("/v1/agent-cards/:id/credentials", mintCredentials)
    .post("/v1/checkouts", createCheckout)
    .get("/v1/checkouts/:id", getCheckout)
    .post("/v1/checkouts/:id/actions/:actionId", submitCheckoutAction)
    .post("/v1/buyer-profiles", createBuyerProfile);
}

/**
 * Build the GOAT HTTP API as Web-standard handlers.
 *
 * ```ts
 * // app/api/goat/[...path]/route.ts
 * export const { GET, POST, PUT, DELETE } = createGoatHandlers({ ... });
 * ```
 */
export function createGoatHandlers(config: GoatServerConfig): GoatHandlers {
  const ctx = createContext(config);
  const router = buildRouter();
  const handler: GoatHandler = async (req) => {
    try {
      return await router.dispatch(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
  return { GET: handler, POST: handler, PUT: handler, DELETE: handler, handler };
}
