import { readFileSync } from "node:fs";
import type { Command } from "commander";
import {
  type BuyerProfileInput,
  isTerminalCheckout,
  pollUntil,
  toDecimalString,
} from "@goat-wallet/core";
import pc from "picocolors";
import type { GoatApi } from "../api.js";
import type { CliContext } from "../context.js";
import { CliExit, EXIT, fail, statusColor, toJson } from "../output.js";
import type { CheckoutView, CreateCheckoutBody } from "../types.js";
import {
  checkoutSummary,
  describeAction,
  getApi,
  type JsonOption,
  parseAmount,
  parseJsonValues,
  parsePositiveNumber,
  pendingAction,
  withJson,
} from "./shared.js";

const CHECKOUT_POLL_MS = 1500;

interface CreateOptions extends JsonOption {
  url: string;
  agentCard: string;
  maxCost: number;
  currency: string;
  request?: string;
  buyerProfile?: string;
  wait?: boolean;
  timeout?: number;
}

export function buildCheckoutBody(opts: CreateOptions): CreateCheckoutBody {
  const body: CreateCheckoutBody = {
    url: opts.url,
    agentCardId: opts.agentCard,
    maxCost: { amount: toDecimalString(opts.maxCost), currency: opts.currency.toUpperCase() },
  };
  if (opts.request) body.request = opts.request;
  if (opts.buyerProfile) body.buyerProfileId = opts.buyerProfile;
  return body;
}

export function registerCheckoutCommands(program: Command, ctx: CliContext): void {
  const co = program
    .command("checkout")
    .description("let Crossmint buy at a URL, paid with an agent card");

  withJson(
    co
      .command("create")
      .description("start a checkout")
      .requiredOption("--url <url>", "product or cart URL")
      .requiredOption("--agent-card <id>", "active agent card that pays")
      .requiredOption("--max-cost <n>", "hard cap for the whole order", parseAmount("--max-cost"))
      .option("--currency <code>", "ISO currency", "USD")
      .option("--request <text>", 'instruction for the shopper, e.g. "medium, black"')
      .option("--buyer-profile <id>", "buyer profile with shipping details")
      .option("--wait", "poll until done, failed, or a question needs an answer")
      .option(
        "--timeout <s>",
        "with --wait: give up after this many seconds",
        parsePositiveNumber("--timeout"),
      ),
  ).action(async (opts: CreateOptions) => {
    const api = getApi(ctx);
    let view = await api.createCheckout(buildCheckoutBody(opts));
    if (!opts.wait) {
      report(ctx, view, opts.json);
      return;
    }
    ctx.err(`Checkout ${view.id} ${statusColor(view.status)}`);
    view = await waitForCheckout(ctx, api, view, opts.timeout);
    report(ctx, view, opts.json);
  });

  withJson(
    co
      .command("get <id>")
      .description("show a checkout; exit 2 when it waits on an answer")
      .option("--wait", "poll until done, failed, or a question needs an answer")
      .option(
        "--timeout <s>",
        "with --wait: give up after this many seconds",
        parsePositiveNumber("--timeout"),
      ),
  ).action(async (id: string, opts: JsonOption & { wait?: boolean; timeout?: number }) => {
    const api = getApi(ctx);
    let view = await api.getCheckout(id);
    if (opts.wait) view = await waitForCheckout(ctx, api, view, opts.timeout);
    report(ctx, view, opts.json);
  });

  withJson(
    co
      .command("answer <id> <actionId>")
      .description("answer a pending question on a checkout")
      .requiredOption("--values <json>", "JSON object with one key per field")
      .option("--wait", "then poll until done, failed, or the next question")
      .option(
        "--timeout <s>",
        "with --wait: give up after this many seconds",
        parsePositiveNumber("--timeout"),
      ),
  ).action(
    async (
      id: string,
      actionId: string,
      opts: JsonOption & { values: string; wait?: boolean; timeout?: number },
    ) => {
      const api = getApi(ctx);
      let view = await api.answerCheckout(id, actionId, parseJsonValues(opts.values));
      if (opts.wait) view = await waitForCheckout(ctx, api, view, opts.timeout);
      report(ctx, view, opts.json);
    },
  );

  const bp = program
    .command("buyer-profile")
    .description("shipping and contact details for checkouts");
  withJson(
    bp
      .command("create")
      .description("create a buyer profile from a JSON file")
      .requiredOption("--json-file <path>", "file with { label, name, contact, shipping }"),
  ).action(async (opts: JsonOption & { jsonFile: string }) => {
    const api = getApi(ctx);
    let input: BuyerProfileInput;
    try {
      input = JSON.parse(readFileSync(opts.jsonFile, "utf8")) as BuyerProfileInput;
    } catch (e) {
      throw fail(`Could not read ${opts.jsonFile}: ${(e as Error).message}`);
    }
    const result = await api.createBuyerProfile(input);
    if (opts.json) ctx.out(toJson(result));
    else ctx.out(`Created buyer profile ${pc.bold(result.id)}.`);
  });
}

/** Poll until terminal or a non-payment action appears. Payment actions never reach the CLI. */
async function waitForCheckout(
  ctx: CliContext,
  api: GoatApi,
  initial: CheckoutView,
  timeoutS: number | undefined,
): Promise<CheckoutView> {
  const done = (v: CheckoutView) => isTerminalCheckout(v) || pendingAction(v) !== undefined;
  if (done(initial)) return initial;
  let last = initial;
  try {
    const gen = pollUntil(() => api.getCheckout(initial.id), done, {
      intervalMs: CHECKOUT_POLL_MS,
      timeoutMs: timeoutS ? timeoutS * 1000 : undefined,
    });
    for await (const v of gen) {
      if (v.status !== last.status) ctx.err(`Status: ${statusColor(v.status)}`);
      last = v;
    }
  } catch (e) {
    if ((e as Error).message === "Polling timed out") {
      throw new CliExit(
        EXIT.ERROR,
        `Timed out while ${last.status}. Check later with \`goat checkout get ${last.id} --wait\`.`,
        "timeout",
      );
    }
    throw e;
  }
  return last;
}

/** Print the view. Exit 2 with instructions when a question waits, 1 on failure. */
function report(ctx: CliContext, view: CheckoutView, json: boolean | undefined): void {
  const action = pendingAction(view);
  if (json) {
    ctx.out(toJson(view));
  } else {
    for (const line of checkoutSummary(view)) ctx.out(line);
    if (view.embedUrl) ctx.out(`  ${pc.dim("Watch:")}    ${view.embedUrl}`);
    if (action) {
      ctx.out("");
      for (const line of describeAction(view.id, action)) ctx.out(line);
    }
  }
  if (action) {
    throw new CliExit(
      EXIT.NEEDS_USER_ACTION,
      json ? `Checkout ${view.id} needs an answer to action ${action.id}.` : "",
      "action_needed",
    );
  }
  if (view.status === "failed" || view.status === "cancelled") {
    const reason = view.failure
      ? `${view.failure.reason}${view.failure.message ? `: ${view.failure.message}` : ""}`
      : view.status;
    throw new CliExit(EXIT.ERROR, `Checkout ${view.status}: ${reason}`, view.status);
  }
}
