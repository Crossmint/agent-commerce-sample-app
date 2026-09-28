import { hostname } from "node:os";
import { createInterface } from "node:readline/promises";
import { type ConfigStore, createConfigStore, type Env } from "./config.js";

/**
 * Everything a command touches outside its own logic. Tests replace pieces of it.
 */
export interface CliContext {
  env: Env;
  fetch: typeof fetch;
  /** Write one line to stdout. */
  out(line?: string): void;
  /** Write one line to stderr. */
  err(line?: string): void;
  config: ConfigStore;
  openBrowser(url: string): Promise<void>;
  prompt(question: string): Promise<string>;
  hostname(): string;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** False when stdout is not a TTY. Colors switch off. */
  color: boolean;
}

export type ContextOverrides = Partial<CliContext>;

export function createContext(overrides: ContextOverrides = {}): CliContext {
  const env = overrides.env ?? process.env;
  const base: CliContext = {
    env,
    // Bind the real fetch now. `withFetch` swaps globalThis.fetch, so a lazy wrapper would call itself.
    fetch: globalThis.fetch.bind(globalThis),
    out: (line = "") => {
      process.stdout.write(`${line}\n`);
    },
    err: (line = "") => {
      process.stderr.write(`${line}\n`);
    },
    config: createConfigStore(env),
    openBrowser: async (url) => {
      const { default: open } = await import("open");
      await open(url);
    },
    prompt: async (question) => {
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      try {
        return (await rl.question(question)).trim();
      } finally {
        rl.close();
      }
    },
    hostname: () => hostname(),
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    color: Boolean(process.stdout.isTTY) && !env.NO_COLOR,
  };
  return { ...base, ...overrides };
}
