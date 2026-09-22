import { hostname as osHostname } from "node:os";
import type { Env } from "./config.js";

/**
 * Who is asking for the card. Shown to the user on the approval page.
 * Detected from the environment of well-known coding agents.
 */
export function detectRequester(env: Env = process.env, hostname: string = osHostname()): string {
  if (env.CLAUDECODE) return "Claude Code";
  if (env.CODEX || env.CODEX_SANDBOX) return "Codex";
  if (env.CURSOR_AGENT) return "Cursor";
  if (env.GEMINI_CLI) return "Gemini CLI";
  return `agent-commerce CLI on ${hostname}`;
}
