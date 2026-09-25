import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship built ESM in dist/. Turbopack resolves them as is.
  // List @agent-commerce/ui here only if you point its exports at src/.
  transpilePackages: [],
  // Postgres and the Stytch node SDK stay external on the server.
  serverExternalPackages: ["postgres", "stytch"],
  // Development diagnostics for joint SDK evaluation against production APIs.
  // Keep request bodies and Server Function arguments out of the terminal.
  logging: {
    browserToTerminal: true,
    fetches: { fullUrl: false },
    serverFunctions: false,
  },
  // /install reads the skill file at request time.
  outputFileTracingIncludes: { "/install": ["./public/skill.md"] },
};

export default nextConfig;
