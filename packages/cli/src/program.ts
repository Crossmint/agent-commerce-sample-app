import { Command, CommanderError } from "commander";
import pc from "picocolors";
import { ApiError } from "./api.js";
import { registerAgentCardCommands } from "./commands/agent-card.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerCardsCommands } from "./commands/cards.js";
import { registerCheckoutCommands } from "./commands/checkout.js";
import { type CliContext, type ContextOverrides, createContext } from "./context.js";
import { CliExit, EXIT, toJson } from "./output.js";

export const VERSION = "2.0.0-alpha.0";

export function createProgram(ctx: CliContext): Command {
  const program = new Command("goat")
    .description(
      "Agentic commerce wallet CLI. Request a bounded agent card, reveal it, or run a checkout.",
    )
    .version(VERSION, "-v, --version")
    .showHelpAfterError("(run with --help for usage)")
    .configureOutput({
      writeOut: (s) => ctx.out(s.replace(/\n$/, "")),
      writeErr: (s) => ctx.err(s.replace(/\n$/, "")),
    })
    .addHelpText(
      "after",
      `
Exit codes:
  0  ok
  1  error
  2  needs the user: an approval URL or a checkout question
  3  not logged in; run \`goat login --api <url>\`

Environment:
  GOAT_API_URL     API base URL (overrides the saved config)
  GOAT_TOKEN       bearer token for CI and agents (no refresh)
  GOAT_CONFIG_DIR  where config.json lives (default ~/.config/goat)`,
    );

  registerAuthCommands(program, ctx);
  registerCardsCommands(program, ctx);
  registerAgentCardCommands(program, ctx);
  registerCheckoutCommands(program, ctx);
  return program;
}

/**
 * Parse and run. Returns the exit code instead of calling `process.exit`,
 * so tests and embedders can reuse it.
 */
export async function runCli(argv: string[], overrides: ContextOverrides = {}): Promise<number> {
  const ctx = createContext(overrides);
  const json = argv.includes("--json");
  const program = createProgram(ctx).exitOverride();
  try {
    await program.parseAsync(argv, { from: "user" });
    return EXIT.OK;
  } catch (e) {
    return reportError(ctx, e, json);
  }
}

function reportError(ctx: CliContext, e: unknown, json: boolean): number {
  if (e instanceof CommanderError) {
    // Help and version exit 0. Usage errors were already printed by commander.
    return e.exitCode;
  }
  if (e instanceof CliExit) {
    if (e.message) emit(ctx, json, e.code, e.message);
    return e.exitCode;
  }
  if (e instanceof ApiError) {
    const suffix = e.code === "unauthorized" ? " Run `goat login` again." : "";
    emit(ctx, json, e.code, `${e.message}${suffix}`, e.details);
    return e.exitCode;
  }
  const message = e instanceof Error ? e.message : String(e);
  emit(ctx, json, "error", message);
  return EXIT.ERROR;
}

function emit(
  ctx: CliContext,
  json: boolean,
  code: string,
  message: string,
  details?: unknown,
): void {
  if (json)
    ctx.err(toJson({ error: { code, message, ...(details === undefined ? {} : { details }) } }));
  else
    ctx.err(
      `${pc.red("Error:")} ${message}${code !== "error" && code !== "cli_error" ? pc.dim(` (${code})`) : ""}`,
    );
}
