#!/usr/bin/env node
/**
 * `goat-mcp`: serve the GOAT tools over stdio for local MCP hosts
 * (Claude Code, Claude Desktop, Cursor, ...).
 *
 *   goat-mcp --api https://wallet.example.com [--requester "Claude Code"]
 *
 * Token: `GOAT_TOKEN` env, else `accessToken` from `~/.config/goat/config.json`
 * written by `goat login`. API URL: `--api`, else `GOAT_API` env, else the config file.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGoatMcpServer } from "./server.js";

interface CliConfig {
  apiBaseUrl?: string;
  accessToken?: string;
}

function parseArgs(argv: string[]): { api?: string; token?: string; requester?: string; help: boolean } {
  const out: { api?: string; token?: string; requester?: string; help: boolean } = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--api") out.api = next();
    else if (arg?.startsWith("--api=")) out.api = arg.slice("--api=".length);
    else if (arg === "--token") out.token = next();
    else if (arg?.startsWith("--token=")) out.token = arg.slice("--token=".length);
    else if (arg === "--requester") out.requester = next();
    else if (arg?.startsWith("--requester=")) out.requester = arg.slice("--requester=".length);
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

export function goatConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME || join(env.HOME || homedir(), ".config");
  return join(base, "goat", "config.json");
}

async function readCliConfig(path: string): Promise<CliConfig> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as CliConfig) : {};
  } catch {
    return {};
  }
}

/**
 * `--api https://wallet.example.com` points at the website. The API lives under
 * `/api/goat` in the reference app. A URL with a path is used as given.
 */
export function resolveApiBaseUrl(input: string): string {
  const url = new URL(input);
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/api/goat";
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/+$/, "");
}

const HELP = `goat-mcp: GOAT wallet tools over MCP stdio.

Usage: goat-mcp --api <url> [--requester <name>] [--token <jwt>]

  --api        GOAT website or API URL, e.g. https://wallet.example.com
  --requester  Name shown to the user on approvals. Default "Agent".
  --token      Bearer token. Default: $GOAT_TOKEN, else ~/.config/goat/config.json.

Log in first with: goat login --api <url>
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stderr.write(HELP);
    return;
  }
  const config = await readCliConfig(goatConfigPath());
  const apiInput = args.api ?? process.env.GOAT_API ?? config.apiBaseUrl;
  const token = args.token ?? process.env.GOAT_TOKEN ?? config.accessToken;

  if (!apiInput) {
    process.stderr.write("goat-mcp: no API URL. Pass --api <url> or run `goat login --api <url>`.\n");
    process.exit(2);
  }
  if (!token) {
    process.stderr.write("goat-mcp: no token. Set GOAT_TOKEN or run `goat login`.\n");
    process.exit(2);
  }

  const server = createGoatMcpServer({
    apiBaseUrl: resolveApiBaseUrl(apiInput),
    bearerToken: token,
    requester: args.requester ?? process.env.GOAT_REQUESTER,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`goat-mcp: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
