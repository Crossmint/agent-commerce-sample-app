#!/usr/bin/env node
/**
 * `agent-commerce-mcp`: serve the Agent Commerce tools over stdio for local MCP hosts
 * (Claude Code, Claude Desktop, Cursor, ...).
 *
 *   agent-commerce-mcp --api https://wallet.example.com [--requester "Claude Code"]
 *
 * Token: `AGENT_COMMERCE_TOKEN` env, else `accessToken` from `~/.config/agent-commerce/config.json`
 * written by `agent-commerce login`. API URL: `--api`, else `AGENT_COMMERCE_API` env, else the config file.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAgentCommerceMcpServer } from "./server.js";

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

export function cliConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME || join(env.HOME || homedir(), ".config");
  return join(base, "agent-commerce", "config.json");
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
 * `/api/agent-commerce` in the reference app. A URL with a path is used as given.
 */
export function resolveApiBaseUrl(input: string): string {
  const url = new URL(input);
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/api/agent-commerce";
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/+$/, "");
}

const HELP = `agent-commerce-mcp: Agent Commerce wallet tools over MCP stdio.

Usage: agent-commerce-mcp --api <url> [--requester <name>] [--token <jwt>]

  --api        Agent Commerce website or API URL, e.g. https://wallet.example.com
  --requester  Name shown to the user on approvals. Default "Agent".
  --token      Bearer token. Default: $AGENT_COMMERCE_TOKEN, else ~/.config/agent-commerce/config.json.

Log in first with: agent-commerce login --api <url>
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stderr.write(HELP);
    return;
  }
  const config = await readCliConfig(cliConfigPath());
  const apiInput = args.api ?? process.env.AGENT_COMMERCE_API ?? config.apiBaseUrl;
  const token = args.token ?? process.env.AGENT_COMMERCE_TOKEN ?? config.accessToken;

  if (!apiInput) {
    process.stderr.write("agent-commerce-mcp: no API URL. Pass --api <url> or run `agent-commerce login --api <url>`.\n");
    process.exit(2);
  }
  if (!token) {
    process.stderr.write("agent-commerce-mcp: no token. Set AGENT_COMMERCE_TOKEN or run `agent-commerce login`.\n");
    process.exit(2);
  }

  const server = createAgentCommerceMcpServer({
    apiBaseUrl: resolveApiBaseUrl(apiInput),
    bearerToken: token,
    requester: args.requester ?? process.env.AGENT_COMMERCE_REQUESTER,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`agent-commerce-mcp: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
