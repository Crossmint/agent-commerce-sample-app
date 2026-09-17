import pc from "picocolors";

/** Process exit codes. The skill documents these for agents. */
export const EXIT = {
  OK: 0,
  ERROR: 1,
  NEEDS_USER_ACTION: 2,
  NOT_LOGGED_IN: 3,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** Stop the command with a code. An empty message prints nothing. */
export class CliExit extends Error {
  readonly exitCode: number;
  readonly code: string;
  constructor(exitCode: number, message = "", code = "cli_error") {
    super(message);
    this.name = "CliExit";
    this.exitCode = exitCode;
    this.code = code;
  }
}

export function notLoggedIn(detail?: string): CliExit {
  const hint = "Run `goat login --api <url>` first.";
  return new CliExit(
    EXIT.NOT_LOGGED_IN,
    detail ? `${detail} ${hint}` : `Not logged in. ${hint}`,
    "not_logged_in",
  );
}

export function fail(message: string, code = "cli_error"): CliExit {
  return new CliExit(EXIT.ERROR, message, code);
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Align `label: value` pairs. */
export function kv(rows: Array<[string, string | undefined]>, indent = "  "): string[] {
  const present = rows.filter((r): r is [string, string] => r[1] !== undefined && r[1] !== "");
  const width = Math.max(0, ...present.map(([k]) => k.length));
  return present.map(([k, v]) => `${indent}${pc.dim(`${k}:`.padEnd(width + 1))} ${v}`);
}

/** Pad columns so rows line up. */
export function table(rows: string[][]): string[] {
  const widths: number[] = [];
  for (const row of rows)
    row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, cell.length)));
  return rows.map((row) =>
    row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0))).join("  "),
  );
}

export function statusColor(status: string): string {
  switch (status) {
    case "active":
    case "succeeded":
    case "approved":
      return pc.green(status);
    case "denied":
    case "failed":
    case "cancelled":
    case "expired":
      return pc.red(status);
    case "pending":
    case "running":
    case "awaiting_input":
      return pc.yellow(status);
    default:
      return status;
  }
}

export function formatDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
