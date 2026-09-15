import { defineConfig } from "tsup";

// `src/bin.ts` starts with a `#!/usr/bin/env node` line. esbuild keeps the
// hashbang of an entry file, so the built `dist/bin.js` is directly executable.
export default defineConfig({
  entry: { index: "src/index.ts", bin: "src/bin.ts" },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts" } },
  sourcemap: true,
  clean: true,
  target: "node20",
  platform: "node",
});
