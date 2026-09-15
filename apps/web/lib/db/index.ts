import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/** True when DATABASE_URL is set. Without it the chat runs stateless and has no history. */
export function isDatabaseConfigured(): boolean {
  return Boolean(serverEnv.optional("DATABASE_URL"));
}

let db: Db | undefined;

/**
 * One postgres.js pool per process, created on first use.
 * Returns null when DATABASE_URL is not set, so callers can branch instead of throwing.
 */
export function getDb(): Db | null {
  const url = serverEnv.optional("DATABASE_URL");
  if (!url) return null;
  db ??= drizzle(postgres(url, { prepare: false }), { schema });
  return db;
}
