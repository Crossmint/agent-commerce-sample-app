/**
 * Server-side env access. One place to read, one place to document.
 * See .env.example at the repo root.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. See .env.example.`);
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v ? v : undefined;
}

export type CrossmintEnv = "staging" | "production";

export function crossmintEnvironment(): CrossmintEnv {
  const raw = (optional("CROSSMINT_ENV") ?? "staging").toLowerCase();
  return raw === "production" ? "production" : "staging";
}

export const serverEnv = {
  required,
  optional,
  crossmintEnvironment,
  /** Public URL of this deployment, for approval links. */
  webBaseUrl(): string {
    return (
      optional("AGENT_COMMERCE_WEB_BASE_URL") ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    ).replace(/\/+$/, "");
  },
  apiBaseUrl(): string {
    return `${this.webBaseUrl()}/api/agent-commerce`;
  },
};

/** Public values. Only NEXT_PUBLIC_* names are inlined into the client bundle. */
export const publicEnv = {
  crossmintClientApiKey: process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY,
  stytchPublicToken: process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN,
};
