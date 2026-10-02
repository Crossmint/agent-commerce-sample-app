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
import { listReveals } from "./handlers/reveals.js";
import {
  cancelCheckout,
  setCheckoutAgentCard,
  createBuyerProfile,
  deleteBuyerProfile,
  getBuyerProfile,
  deleteBrowserProfile,
  getBrowserProfile,
  createCheckout,
  getCheckout,
  listCheckoutMessages,
  streamCheckoutMessages,
  sendCheckoutMessage,
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
import type { AgentCommerceServerConfig } from "./types.js";

export type { CheckoutProtectedRequest, CheckoutView } from "./handlers/checkouts.js";
export { buildPublicConfig } from "./handlers/config.js";
export { HttpError, type ErrorCode } from "./errors.js";
export { routePath } from "./router.js";
export { memoryCheckoutStore, memoryRevealStore, memorySessionStore, memoryRequestStore } from "./store/memory.js";
export * from "./types.js";

export type AgentCommerceHandler = (req: Request) => Promise<Response>;

export interface AgentCommerceHandlers {
  GET: AgentCommerceHandler;
  POST: AgentCommerceHandler;
  PUT: AgentCommerceHandler;
  DELETE: AgentCommerceHandler;
  /** Dispatches on `req.method`. */
  handler: AgentCommerceHandler;
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
    .get("/v1/reveals", listReveals)
    .post("/v1/checkouts", createCheckout)
    .get("/v1/checkouts/:id", getCheckout)
    .get("/v1/checkouts/:id/messages", listCheckoutMessages)
    .get("/v1/checkouts/:id/messages/stream", streamCheckoutMessages)
    .post("/v1/checkouts/:id/messages", sendCheckoutMessage)
    .post("/v1/checkouts/:id/cancel", cancelCheckout)
    .post("/v1/checkouts/:id/agent-card", setCheckoutAgentCard)
    .post("/v1/checkouts/:id/actions/:actionId", submitCheckoutAction)
    .post("/v1/buyer-profiles", createBuyerProfile)
    .get("/v1/buyer-profile", getBuyerProfile)
    .delete("/v1/buyer-profile", deleteBuyerProfile)
    .get("/v1/browser-profile", getBrowserProfile)
    .delete("/v1/browser-profile", deleteBrowserProfile);
}

/**
 * Build the Agent Commerce HTTP API as Web-standard handlers.
 *
 * ```ts
 * // app/api/agent-commerce/[...path]/route.ts
 * export const { GET, POST, PUT, DELETE } = createAgentCommerceHandlers({ ... });
 * ```
 */
export function createAgentCommerceHandlers(config: AgentCommerceServerConfig): AgentCommerceHandlers {
  const ctx = createContext(config);
  const router = buildRouter();
  const handler: AgentCommerceHandler = async (req) => {
    try {
      return await router.dispatch(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
  return { GET: handler, POST: handler, PUT: handler, DELETE: handler, handler };
}
