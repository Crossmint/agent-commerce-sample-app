import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local dev keeps its secrets in apps/web/.env.local. See .env.example at the repo root.
config({ path: ".env.local" });

/**
 * One schema for the whole app: the chat tables and Agent Commerce's own tables from
 * `@agent-commerce/server/drizzle`. `pnpm db:push` creates all of them.
 *
 * The server package is listed by file path. drizzle-kit resolves imports with
 * Node's CommonJS resolver, which cannot see the package's `import`-only
 * `./drizzle` export. The built file ships in the npm package, so the path is
 * stable inside and outside the monorepo.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: ["./lib/db/schema.ts", "./node_modules/@agent-commerce/server/dist/drizzle.js"],
  out: "./lib/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
