import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** What `goat login` stores. Lives in `~/.config/goat/config.json` with mode 0600. */
export interface GoatConfig {
  apiBaseUrl: string;
  accessToken?: string;
  refreshToken?: string;
  /** ISO timestamp for when `accessToken` stops working. */
  expiresAt?: string;
  /** OAuth token endpoint, kept so refresh needs no network discovery. */
  tokenEndpoint?: string;
  /** OAuth client id of the CLI Connected App. */
  clientId?: string;
  userId?: string;
  email?: string;
}

export type Env = Record<string, string | undefined>;

/** `$XDG_CONFIG_HOME/goat` or `~/.config/goat`. `GOAT_CONFIG_DIR` wins when set. */
export function configDir(env: Env = process.env): string {
  if (env.GOAT_CONFIG_DIR) return env.GOAT_CONFIG_DIR;
  const base =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim() !== ""
      ? env.XDG_CONFIG_HOME
      : join(homedir(), ".config");
  return join(base, "goat");
}

export function configPath(env: Env = process.env): string {
  return join(configDir(env), "config.json");
}

export interface ConfigStore {
  readonly path: string;
  read(): GoatConfig | null;
  write(config: GoatConfig): void;
  clear(): void;
}

export function createConfigStore(env: Env = process.env): ConfigStore {
  const path = configPath(env);
  return {
    path,
    read: () => readConfig(path),
    write: (config) => writeConfig(config, path),
    clear: () => clearConfig(path),
  };
}

export function readConfig(path: string = configPath()): GoatConfig | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<GoatConfig>;
    if (!raw || typeof raw.apiBaseUrl !== "string") return null;
    return raw as GoatConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: GoatConfig, path: string = configPath()): void {
  const dir = join(path, "..");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // `mode` is ignored when the file already exists. Force it.
  chmodSync(path, 0o600);
}

export function clearConfig(path: string = configPath()): void {
  rmSync(path, { force: true });
}

/**
 * Effective settings for one command run. The file is the base. Environment
 * variables override it so CI and agents need no login step:
 * - `GOAT_API_URL`: API base URL, e.g. https://wallet.example.com/api/goat
 * - `GOAT_TOKEN`: a bearer token. No refresh happens for env tokens.
 */
export interface ResolvedConfig extends GoatConfig {
  /** True when the token came from `GOAT_TOKEN`. */
  tokenFromEnv: boolean;
}

export function resolveConfig(store: ConfigStore, env: Env = process.env): ResolvedConfig | null {
  const file = store.read();
  const apiBaseUrl = normalizeBaseUrl(env.GOAT_API_URL ?? file?.apiBaseUrl);
  if (!apiBaseUrl) return null;
  if (env.GOAT_TOKEN) {
    return {
      ...(file ?? {}),
      apiBaseUrl,
      accessToken: env.GOAT_TOKEN,
      refreshToken: undefined,
      expiresAt: undefined,
      tokenFromEnv: true,
    };
  }
  return { ...(file ?? {}), apiBaseUrl, tokenFromEnv: false };
}

export function normalizeBaseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed === "" ? undefined : trimmed;
}
