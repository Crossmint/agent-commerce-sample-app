import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts", "src/stytch.ts", "src/generic-jwks.ts", "src/oauth.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
});
