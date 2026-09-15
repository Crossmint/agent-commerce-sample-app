import { defineConfig } from "tsup";

// `src/bin.ts` starts with a shebang line. esbuild keeps it at the top of the
// output and tsup marks the file executable, so no banner is needed.
export default defineConfig({
  entry: { index: "src/index.ts", bin: "src/bin.ts" },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts" } },
  sourcemap: true,
  clean: true,
  target: "node20",
  platform: "node",
});
