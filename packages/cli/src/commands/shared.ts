import type { Command } from "commander";
import type { Merchant, PendingUserAction, RenderedAction, RenderedField } from "@goat-wallet/core";
import { renderPendingAction } from "@goat-wallet/core";
import pc from "picocolors";
import { GoatApi } from "../api.js";
import { resolveConfig } from "../config.js";
import type { CliContext } from "../context.js";
import { fail, kv, notLoggedIn } from "../output.js";
import type { CheckoutView } from "../types.js";

export interface JsonOption {
  json?: boolean;
}

export function withJson(cmd: Command): Command {
  return cmd.option("--json", "print raw JSON");
}

/** Build an authenticated client, or exit 3. */
export function getApi(ctx: CliContext): GoatApi {
  const config = resolveConfig(ctx.config, ctx.env);
  if (!config) throw notLoggedIn();
  if (!config.accessToken) throw notLoggedIn();
  return new GoatApi({
    config,
    fetch: ctx.fetch,
    store: config.tokenFromEnv ? undefined : ctx.config,
    now: ctx.now,
  });
}

export interface MerchantOptions {
  merchantName?: string;
  merchantUrl?: string;
  merchantCountry?: string;
}

/** All three merchant fields, or none. */
export function merchantFromOptions(opts: MerchantOptions): Merchant | undefined {
  const { merchantName, merchantUrl, merchantCountry } = opts;
  if (!merchantName && !merchantUrl && !merchantCountry) return undefined;
  if (!merchantName || !merchantUrl || !merchantCountry) {
    throw fail("Pass --merchant-name, --merchant-url and --merchant-country together.");
  }
  return { name: merchantName, url: merchantUrl, countryCode: merchantCountry.toUpperCase() };
}

export function parsePositiveNumber(label: string): (value: string) => number {
  return (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0)
      throw fail(`${label} must be a positive number, got "${value}".`);
    return n;
  };
}

/** Money input. Accepts "50", "49.99", "$50", "1,000". */
export function parseAmount(label: string): (value: string) => number {
  return (value) => {
    const n = Number(value.replace(/[$€£,\s]/g, ""));
    if (!Number.isFinite(n) || n <= 0)
      throw fail(`${label} must be a positive amount, got "${value}".`);
    return n;
  };
}

export function parseJsonValues(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw fail(`--values is not valid JSON: ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw fail("--values must be a JSON object.");
  return parsed as Record<string, unknown>;
}

/** The action a checkout is waiting on, rendered. Prefers the server's `rendered`. */
export function pendingAction(view: CheckoutView): RenderedAction | undefined {
  if (view.rendered) return view.rendered;
  if (view.pendingUserAction)
    return renderPendingAction(view.pendingUserAction as PendingUserAction);
  return undefined;
}

/** Lines that describe a pending action and how to answer it. */
export function describeAction(checkoutId: string, action: RenderedAction): string[] {
  const lines: string[] = [];
  lines.push(`${pc.yellow("Action needed:")} ${pc.bold(action.title)} ${pc.dim(`(${action.id})`)}`);
  if (action.description) lines.push(`  ${action.description}`);
  if (action.expiresAt) lines.push(`  ${pc.dim("Expires:")} ${action.expiresAt}`);
  lines.push("");
  for (const line of fieldLines(action.fields, "  ")) lines.push(line);
  lines.push("");
  lines.push("Answer with:");
  lines.push(
    `  goat checkout answer ${checkoutId} ${action.id} --values '${JSON.stringify(valuesTemplate(action.fields))}'`,
  );
  lines.push(`  ${pc.dim("or")} --decline ${pc.dim("/")} --alternative "<what to do instead>"`);
  return lines;
}

function fieldLines(fields: RenderedField[], indent: string): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const req = f.required ? pc.red("*") : " ";
    let kind: string = f.kind;
    if (f.kind === "select" && f.options)
      kind = `one of: ${f.options.map((o) => JSON.stringify(o.value)).join(", ")}`;
    const desc = f.description ? ` ${pc.dim(f.description)}` : "";
    out.push(`${indent}${f.name}${req} ${pc.dim(`(${kind})`)} ${f.label}${desc}`);
    if (f.children?.length) out.push(...fieldLines(f.children, `${indent}  `));
  }
  return out;
}

/** A `values` object with one placeholder per field. */
export function valuesTemplate(fields: RenderedField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default !== undefined) out[f.name] = f.default;
    else if (f.kind === "object" && f.children) out[f.name] = valuesTemplate(f.children);
    else if (f.kind === "select" && f.options?.[0]) out[f.name] = f.options[0].value;
    else if (f.kind === "boolean") out[f.name] = false;
    else if (f.kind === "number") out[f.name] = 0;
    else if (f.kind === "array") out[f.name] = [];
    else out[f.name] = "";
  }
  return out;
}

export function checkoutSummary(view: CheckoutView): string[] {
  const receipt = view.receipt;
  const total = receipt ? `${receipt.total.amount} ${receipt.total.currency}` : undefined;
  return kv([
    ["Checkout", view.id],
    ["Status", view.status],
    ["Agent card", view.agentCardId],
    ["Total", total],
    ["Order", receipt?.merchantOrderId],
    ["Spent", view.spentUsd ? `${view.spentUsd} USD` : undefined],
    ["Summary", view.result?.summary],
    [
      view.status === "blocked" ? "Blocked" : "Failure",
      view.failure
        ? `${view.failure.reason}${view.failure.message && view.failure.message !== view.result?.summary ? `: ${view.failure.message}` : ""}`
        : undefined,
    ],
  ]);
}
