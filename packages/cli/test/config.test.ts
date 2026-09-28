import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { configDir, createConfigStore, normalizeBaseUrl, resolveConfig } from "../src/config.js";
import { tempConfigDir } from "./helpers.js";

describe("config store", () => {
  it("round-trips config with 0600 permissions", () => {
    const dir = tempConfigDir();
    const store = createConfigStore({ AGENT_COMMERCE_CONFIG_DIR: dir });
    expect(store.read()).toBeNull();
    store.write({
      apiBaseUrl: "https://a.test/api/agent-commerce",
      accessToken: "t",
      refreshToken: "r",
      expiresAt: "2030-01-01T00:00:00.000Z",
      email: "a@b.c",
    });
    expect(store.path).toBe(join(dir, "config.json"));
    expect(statSync(store.path).mode & 0o777).toBe(0o600);
    expect(store.read()).toMatchObject({
      apiBaseUrl: "https://a.test/api/agent-commerce",
      accessToken: "t",
      email: "a@b.c",
    });
    // Overwrite keeps the mode.
    store.write({ apiBaseUrl: "https://b.test" });
    expect(statSync(store.path).mode & 0o777).toBe(0o600);
    expect(store.read()?.apiBaseUrl).toBe("https://b.test");
    store.clear();
    expect(store.read()).toBeNull();
  });

  it("respects XDG_CONFIG_HOME and AGENT_COMMERCE_CONFIG_DIR", () => {
    expect(configDir({ XDG_CONFIG_HOME: "/xdg" })).toBe("/xdg/agent-commerce");
    expect(configDir({ AGENT_COMMERCE_CONFIG_DIR: "/custom", XDG_CONFIG_HOME: "/xdg" })).toBe("/custom");
    expect(configDir({})).toMatch(/\.config\/agent-commerce$/);
  });

  it("lets AGENT_COMMERCE_API_URL and AGENT_COMMERCE_TOKEN override the file", () => {
    const dir = tempConfigDir();
    const store = createConfigStore({ AGENT_COMMERCE_CONFIG_DIR: dir });
    store.write({ apiBaseUrl: "https://file.test", accessToken: "file-token", refreshToken: "r" });
    const fromFile = resolveConfig(store, {});
    expect(fromFile).toMatchObject({
      apiBaseUrl: "https://file.test",
      accessToken: "file-token",
      tokenFromEnv: false,
    });
    const fromEnv = resolveConfig(store, {
      AGENT_COMMERCE_API_URL: "https://env.test/",
      AGENT_COMMERCE_TOKEN: "env-token",
    });
    expect(fromEnv).toMatchObject({
      apiBaseUrl: "https://env.test",
      accessToken: "env-token",
      tokenFromEnv: true,
    });
    expect(fromEnv?.refreshToken).toBeUndefined();
    // No file and no env: nothing to resolve.
    expect(resolveConfig(createConfigStore({ AGENT_COMMERCE_CONFIG_DIR: tempConfigDir() }), {})).toBeNull();
  });

  it("normalizes base URLs", () => {
    expect(normalizeBaseUrl("https://a.test/api/agent-commerce///")).toBe("https://a.test/api/agent-commerce");
    expect(normalizeBaseUrl("  ")).toBeUndefined();
  });
});
