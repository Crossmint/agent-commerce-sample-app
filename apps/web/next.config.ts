import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship built ESM in dist/. Turbopack resolves them as is.
  // List @agent-commerce/ui here only if you point its exports at src/.
  transpilePackages: [],
  // Postgres and the Stytch node SDK stay external on the server.
  serverExternalPackages: ["postgres", "stytch"],
};

export default nextConfig;
