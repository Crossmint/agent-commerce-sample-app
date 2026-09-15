import { defineConfig } from "tsup";

/**
 * One ESM bundle. Every module in this package runs in the browser, so the
 * whole bundle carries one "use client" directive. esbuild drops per-file
 * directives when it bundles; the banner puts it back at the top.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "browser",
  external: ["react", "react-dom", "react/jsx-runtime"],
  banner: { js: '"use client";' },
  esbuildOptions(options) {
    // Silence "ignoring 'use client' directive" warnings from bundled files.
    options.logOverride = { ...options.logOverride, "ignored-directive": "silent" };
  },
});
