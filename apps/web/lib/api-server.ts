import { createStytchUserAuth, inferStytchEnvironment } from "@agent-commerce/auth/stytch";
import { parsePrivateJwk } from "@agent-commerce/core";
import { createAgentCommerceHandlers, memoryRequestStore } from "@agent-commerce/server";
import { serverEnv } from "./env";

type Handlers = ReturnType<typeof createAgentCommerceHandlers>;

/**
 * Builds the Agent Commerce API handlers from env vars, once per process.
 * With DATABASE_URL set, requests persist in Postgres through Drizzle.
 * Without it, they live in memory: fine for a first `pnpm dev`.
 */
let handlersPromise: Promise<Handlers> | undefined;

export function getAgentCommerceHandlers(): Promise<Handlers> {
  handlersPromise ??= buildHandlers();
  return handlersPromise;
}

/**
 * The in-memory store, when there is no database, kept on `globalThis`.
 * Next bundles each route on its own, so /api/chat and /api/agent-commerce
 * each build their own handlers; a module variable would give each its own
 * memory, and details saved on the profile page would be missing in the
 * chat. Only the data is shared: the handlers are rebuilt with new code.
 */
const shared = globalThis as typeof globalThis & {
  __agentCommerceMemoryStore?: ReturnType<typeof memoryRequestStore>;
};

async function buildHandlers(): Promise<Handlers> {
  const projectId = serverEnv.required("STYTCH_PROJECT_ID");
  const stytchEnv = inferStytchEnvironment(projectId);

  const projectDomain = serverEnv.optional("STYTCH_PROJECT_DOMAIN");
  const userAuth = createStytchUserAuth({
    projectId,
    secret: serverEnv.optional("STYTCH_SECRET"),
    environment: stytchEnv,
    projectDomain,
  });

  const store = await buildStore();

  const privateKeyRaw = serverEnv.optional("AGENT_COMMERCE_ENCRYPTED_CARD_PRIVATE_KEY");
  const encryptedCardPrivateJwk = privateKeyRaw ? parsePrivateJwk(privateKeyRaw) : undefined;

  return createAgentCommerceHandlers({
    crossmint: {
      clientApiKey: serverEnv.required("CROSSMINT_CLIENT_API_KEY"),
      serverApiKey: serverEnv.optional("CROSSMINT_SERVER_API_KEY"),
      environment: serverEnv.crossmintEnvironment(),
    },
    userAuth,
    store,
    encryptedCardPrivateJwk,
    webBaseUrl: serverEnv.webBaseUrl(),
    apiBaseUrl: serverEnv.apiBaseUrl(),
    auth: {
      provider: "stytch",
      projectId,
      environment: stytchEnv,
      cliClientId: serverEnv.optional("STYTCH_CLI_CLIENT_ID"),
      mcpClientId: serverEnv.optional("STYTCH_MCP_CLIENT_ID"),
      projectDomain,
      authorizationUrl: `${serverEnv.webBaseUrl()}/oauth/authorize`,
    },
    defaultRequester: "Agent",
  });
}

async function buildStore() {
  const databaseUrl = serverEnv.optional("DATABASE_URL");
  if (!databaseUrl) {
    shared.__agentCommerceMemoryStore ??= memoryRequestStore();
    return shared.__agentCommerceMemoryStore;
  }

  // Loaded only when a database is configured, so a dev without Postgres
  // never pays for these imports.
  const [{ drizzleRequestStore }, { drizzle }, { default: postgres }] = await Promise.all([
    import("@agent-commerce/server/drizzle"),
    import("drizzle-orm/postgres-js"),
    import("postgres"),
  ]);
  const sql = postgres(databaseUrl, { prepare: false });
  const db = drizzle(sql);
  return drizzleRequestStore(db);
}
