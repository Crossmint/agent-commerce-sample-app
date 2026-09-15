import { bearerToken, type AuthenticatedUser } from "@goat-wallet/auth";
import { CrossmintClient, DEFAULT_RAIL_PREFERENCE, type RailKind } from "@goat-wallet/core";
import { z } from "zod";
import { invalidRequest, unauthorized } from "./errors.js";
import { memoryCheckoutStore } from "./store/memory.js";
import type { CheckoutStore, GoatServerConfig, RequestStore } from "./types.js";

export interface Ctx {
  config: GoatServerConfig;
  crossmint: CrossmintClient;
  store: RequestStore;
  checkouts: CheckoutStore;
  requestTtlMinutes: number;
  defaultRequester: string;
  railPreference: RailKind[];
  now(): Date;
}

export function createContext(config: GoatServerConfig): Ctx {
  const crossmint = new CrossmintClient({
    clientApiKey: config.crossmint.clientApiKey,
    serverApiKey: config.crossmint.serverApiKey,
    environment: config.crossmint.environment,
    baseUrl: config.crossmint.baseUrl,
    checkoutsBaseUrl: config.crossmint.checkoutsBaseUrl,
    fetch: config.crossmint.fetch,
  });

  let checkouts: CheckoutStore;
  if (
    typeof config.store.linkCheckout === "function" &&
    typeof config.store.getCheckout === "function"
  ) {
    checkouts = config.store as RequestStore & CheckoutStore;
  } else {
    console.warn(
      "[goat] store has no linkCheckout/getCheckout. Falling back to an in-memory map. " +
        "Checkout to agent card links are lost on restart.",
    );
    checkouts = memoryCheckoutStore();
  }

  return {
    config,
    crossmint,
    store: config.store,
    checkouts,
    requestTtlMinutes: config.requestTtlMinutes ?? 15,
    defaultRequester: config.defaultRequester ?? "Agent",
    railPreference: config.railPreference ?? DEFAULT_RAIL_PREFERENCE,
    now: () => new Date(),
  };
}

/** Verify the bearer token. Throws 401 when it is missing or invalid. */
export async function requireUser(req: Request, ctx: Ctx): Promise<AuthenticatedUser> {
  const jwt = bearerToken(req);
  if (!jwt) throw unauthorized("Missing Authorization: Bearer <jwt>");
  const user = await ctx.config.userAuth.verify(jwt);
  if (!user) throw unauthorized("Invalid or expired token");
  return { ...user, jwt: user.jwt || jwt };
}

/** Parse a JSON body with a zod schema. Throws 400 on failure. */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<z.output<T>> {
  let raw: unknown;
  const text = await req.text();
  if (!text) {
    raw = {};
  } else {
    try {
      raw = JSON.parse(text);
    } catch {
      throw invalidRequest("Body is not valid JSON");
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw invalidRequest("Invalid request body", { issues: result.error.issues });
  }
  return result.data;
}
