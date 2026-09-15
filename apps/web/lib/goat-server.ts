import { createStytchUserAuth, inferStytchEnvironment } from "@goat-wallet/auth/stytch";
import { parsePrivateJwk } from "@goat-wallet/core";
import { createGoatHandlers, memoryRequestStore } from "@goat-wallet/server";
import { serverEnv } from "./env";

type Handlers = ReturnType<typeof createGoatHandlers>;

/**
 * Builds the GOAT API handlers from env vars, once per process.
 * With DATABASE_URL set, requests persist in Postgres through Drizzle.
 * Without it, they live in memory: fine for a first `pnpm dev`.
 */
let handlersPromise: Promise<Handlers> | undefined;

export function getGoatHandlers(): Promise<Handlers> {
  handlersPromise ??= buildHandlers();
  return handlersPromise;
}

async function buildHandlers(): Promise<Handlers> {
  const projectId = serverEnv.required("STYTCH_PROJECT_ID");
  const stytchEnv = inferStytchEnvironment(projectId);

  const userAuth = createStytchUserAuth({
    projectId,
    secret: serverEnv.optional("STYTCH_SECRET"),
    environment: stytchEnv,
  });

  const store = await buildStore();

  const privateKeyRaw = serverEnv.optional("GOAT_ENCRYPTED_CARD_PRIVATE_KEY");
  const encryptedCardPrivateJwk = privateKeyRaw ? parsePrivateJwk(privateKeyRaw) : undefined;

  return createGoatHandlers({
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
    },
    defaultRequester: "Agent",
  });
}

async function buildStore() {
  const databaseUrl = serverEnv.optional("DATABASE_URL");
  if (!databaseUrl) return memoryRequestStore();

  // Loaded only when a database is configured, so a dev without Postgres
  // never pays for these imports.
  const [{ drizzleRequestStore }, { drizzle }, { default: postgres }] = await Promise.all([
    import("@goat-wallet/server/drizzle"),
    import("drizzle-orm/postgres-js"),
    import("postgres"),
  ]);
  const sql = postgres(databaseUrl, { prepare: false });
  const db = drizzle(sql);
  return drizzleRequestStore(db);
}
