import type { Command } from "commander";
import {
  type AgentCard,
  describeRail,
  formatAmount,
  pollUntil,
  toDecimalString,
} from "@agent-commerce/core";
import pc from "picocolors";
import type { AgentCommerceApi } from "../api.js";
import type { CliContext } from "../context.js";
import { CliExit, EXIT, fail, formatDate, kv, statusColor, table, toJson } from "../output.js";
import { detectRequester } from "../requester.js";
import type {
  AgentCardRequest,
  AgentCardRequestStatus,
  CreateAgentCardRequestBody,
  MintCredentialBody,
} from "../types.js";
import {
  getApi,
  type JsonOption,
  merchantFromOptions,
  type MerchantOptions,
  parseAmount,
  parsePositiveNumber,
  withJson,
} from "./shared.js";

const REQUEST_POLL_MS = 2000;
const TERMINAL_REQUEST: ReadonlySet<AgentCardRequestStatus> = new Set([
  "active",
  "denied",
  "expired",
  "failed",
]);

interface RequestOptions extends JsonOption, MerchantOptions {
  amount: number;
  currency: string;
  description: string;
  expiresInHours: number;
  requester?: string;
  wait?: boolean;
  timeout?: number;
}

/** Pure: turn parsed CLI options into the POST body. Tested on its own. */
export function buildRequestBody(
  opts: RequestOptions,
  ctx: Pick<CliContext, "env" | "hostname">,
): CreateAgentCardRequestBody {
  const merchant = merchantFromOptions(opts);
  if (!merchant) throw fail("Provide --merchant-name, --merchant-url and --merchant-country for authorization.");
  const body: CreateAgentCardRequestBody = {
    amount: { value: toDecimalString(opts.amount), currency: opts.currency.toUpperCase() },
    description: opts.description,
    merchant,
    expiresInHours: opts.expiresInHours,
    requester: opts.requester ?? detectRequester(ctx.env, ctx.hostname()),
  };
  return body;
}

export function registerAgentCardCommands(program: Command, ctx: CliContext): void {
  const ac = program
    .command("agent-card")
    .alias("card")
    .description("bounded agent cards on a saved card");

  withJson(
    ac
      .command("request")
      .description("ask the user to approve a new agent card; prints the approval URL")
      .requiredOption("--amount <n>", "budget, e.g. 50 or 49.99", parseAmount("--amount"))
      .option("--currency <code>", "ISO currency", "USD")
      .requiredOption("--description <text>", "what the card is for; the user sees this")
      .requiredOption("--merchant-name <name>", "lock to one merchant: name")
      .requiredOption("--merchant-url <url>", "lock to one merchant: URL")
      .requiredOption("--merchant-country <cc>", "lock to one merchant: ISO country code")
      .option(
        "--expires-in-hours <h>",
        "agent card lifetime",
        parsePositiveNumber("--expires-in-hours"),
        24,
      )
      .option("--requester <name>", "who is asking; default is detected from the environment")
      .option("--wait", "block until the user approves or denies")
      .option(
        "--timeout <s>",
        "with --wait: give up after this many seconds",
        parsePositiveNumber("--timeout"),
      ),
  ).action(async (opts: RequestOptions) => {
    const api = getApi(ctx);
    const body = buildRequestBody(opts, ctx);
    const request = await api.createAgentCardRequest(body);

    if (!opts.wait) {
      if (opts.json) ctx.out(toJson(request));
      else printRequest(ctx, request);
      return;
    }

    if (opts.json) {
      // Progress goes to stderr so stdout stays one JSON document.
      ctx.err(`Approval URL: ${request.approvalUrl}`);
      ctx.err("Waiting for approval...");
    } else {
      printRequest(ctx, request);
      ctx.out(pc.dim("Waiting for approval... (Ctrl-C stops waiting; the request stays open)"));
    }
    const final = await waitForRequest(ctx, api, request, opts.timeout);
    await printFinalRequest(ctx, api, final, opts.json);
  });

  withJson(
    ac
      .command("status <requestId>")
      .description("show an agent card request; --wait blocks until it is answered")
      .option("--wait", "block until the user approves or denies")
      .option(
        "--timeout <s>",
        "with --wait: give up after this many seconds",
        parsePositiveNumber("--timeout"),
      ),
  ).action(async (requestId: string, opts: JsonOption & { wait?: boolean; timeout?: number }) => {
    const api = getApi(ctx);
    let request = await api.getAgentCardRequest(requestId);
    if (opts.wait && !TERMINAL_REQUEST.has(request.status)) {
      if (!opts.json) printRequest(ctx, request);
      ctx.err("Waiting for approval...");
      request = await waitForRequest(ctx, api, request, opts.timeout);
    }
    await printFinalRequest(ctx, api, request, opts.json, !opts.wait);
  });

  withJson(ac.command("list").description("list agent cards")).action(async (opts: JsonOption) => {
    const api = getApi(ctx);
    const { agentCards } = await api.listAgentCards();
    if (opts.json) {
      ctx.out(toJson(agentCards));
      return;
    }
    if (agentCards.length === 0) {
      ctx.out("No agent cards. Create one with `agent-commerce agent-card request`.");
      return;
    }
    const rows = agentCards.map((c) => [
      c.orderIntentId,
      statusColor(c.status),
      `${formatAmount(c.amount.available, c.amount.currency)} of ${formatAmount(c.amount.total, c.amount.currency)}`,
      c.description,
      pc.dim(formatDate(c.expiresAt) ?? ""),
    ]);
    for (const line of table(rows)) ctx.out(line.trimEnd());
  });

  withJson(ac.command("get <id>").description("show one agent card")).action(
    async (id: string, opts: JsonOption) => {
      const api = getApi(ctx);
      const card = await api.getAgentCard(id);
      if (opts.json) ctx.out(toJson(card));
      else for (const line of agentCardLines(card)) ctx.out(line);
    },
  );

  withJson(ac.command("revoke <id>").description("revoke an agent card")).action(
    async (id: string, opts: JsonOption) => {
      const api = getApi(ctx);
      await api.revokeAgentCard(id);
      if (opts.json) ctx.out(toJson({ agentCardId: id, revoked: true }));
      else ctx.out(`Revoked ${id}.`);
    },
  );

  withJson(
    ac
      .command("reveal <id>")
      .description(
        "mint a scoped card number from an active agent card. Name the merchant (--merchant-*) unless the card is locked to one",
      )
      .option(
        "--amount <n>",
        "cap for this credential; defaults to the card's budget",
        parseAmount("--amount"),
      )
      .option("--currency <code>", "ISO currency", "USD")
      .option("--merchant-name <name>", "merchant lock: name")
      .option("--merchant-url <url>", "merchant lock: URL")
      .option("--merchant-country <cc>", "merchant lock: ISO country code"),
  ).action(
    async (
      id: string,
      opts: JsonOption & MerchantOptions & { amount?: number; currency: string },
    ) => {
      const api = getApi(ctx);
      const body: MintCredentialBody = { format: "card" };
      if (opts.amount !== undefined)
        body.amount = {
          value: toDecimalString(opts.amount),
          currency: opts.currency.toUpperCase(),
        };
      const merchant = merchantFromOptions(opts);
      if (!merchant) throw fail("Provide --merchant-name, --merchant-url and --merchant-country for authorization.");
  body.merchant = merchant;
      const cred = await api.mintCredential(id, body);
      if (opts.json) {
        ctx.out(toJson(cred));
      } else {
        const rows: Array<[string, string | undefined]> = [];
        if (cred.card) {
          rows.push(["Card number", cred.card.number]);
          rows.push(["Expiry", `${cred.card.expirationMonth}/${cred.card.expirationYear}`]);
          rows.push(["CVC", cred.card.cvc]);
        }
        if (cred.token) rows.push(["Token", cred.token]);
        rows.push(["Rail", cred.provider ? `${cred.rail} (${cred.provider})` : cred.rail]);
        rows.push(["Enforced", cred.enforced ? "yes" : "no"]);
        rows.push(["Expires", formatDate(cred.expiresAt)]);
        for (const line of kv(rows, "")) ctx.out(line);
      }
      if (!cred.enforced) {
        ctx.err(
          pc.yellow("Warning: limit not enforced by the network. Prefer `agent-commerce checkout create`."),
        );
      }
    },
  );
}

async function waitForRequest(
  ctx: CliContext,
  api: AgentCommerceApi,
  request: AgentCardRequest,
  timeoutS: number | undefined,
): Promise<AgentCardRequest> {
  const requestDeadline = new Date(request.requestExpiresAt).getTime();
  const deadlines = [
    Number.isFinite(requestDeadline) ? requestDeadline + REQUEST_POLL_MS * 2 : Infinity,
  ];
  if (timeoutS) deadlines.push(ctx.now() + timeoutS * 1000);
  const deadline = Math.min(...deadlines);
  const timeoutMs =
    deadline === Infinity ? undefined : Math.max(REQUEST_POLL_MS, deadline - ctx.now());

  let last = request;
  try {
    const gen = pollUntil(
      () => api.getAgentCardRequest(request.id),
      (r) => TERMINAL_REQUEST.has(r.status),
      {
        intervalMs: REQUEST_POLL_MS,
        timeoutMs,
      },
    );
    for await (const r of gen) {
      if (r.status !== last.status) ctx.err(`Status: ${r.status}`);
      last = r;
    }
  } catch (e) {
    if ((e as Error).message === "Polling timed out") {
      throw new CliExit(
        EXIT.NEEDS_USER_ACTION,
        `Still ${last.status}. Ask the user to open ${last.approvalUrl}, then run \`agent-commerce agent-card status ${last.id} --wait\`.`,
        "approval_pending",
      );
    }
    throw e;
  }
  return last;
}

async function printFinalRequest(
  ctx: CliContext,
  api: AgentCommerceApi,
  request: AgentCardRequest,
  json: boolean | undefined,
  allowPending = false,
): Promise<void> {
  let card: AgentCard | undefined;
  if (request.status === "active" && request.agentCardId) {
    try {
      card = await api.getAgentCard(request.agentCardId);
    } catch {
      card = undefined;
    }
  }
  if (json) {
    ctx.out(toJson(card ? { request, agentCard: card } : request));
  } else if (request.status === "active") {
    ctx.out(`${pc.green("Approved.")} Agent card ${pc.bold(request.agentCardId ?? "")} is active.`);
    if (card) for (const line of agentCardLines(card)) ctx.out(line);
    ctx.out("");
    ctx.out(
      `Next: agent-commerce checkout create --url <product url> --agent-card ${request.agentCardId} --max-cost ${request.amount.value} --wait`,
    );
  } else {
    printRequest(ctx, request);
  }
  if (request.status === "denied")
    throw new CliExit(EXIT.ERROR, "The user denied the request.", "denied");
  if (request.status === "expired")
    throw new CliExit(EXIT.ERROR, "The request expired before the user answered.", "expired");
  if (request.status === "failed")
    throw new CliExit(
      EXIT.ERROR,
      `The request failed: ${request.failureReason ?? "unknown reason"}.`,
      "failed",
    );
  if (!allowPending && !TERMINAL_REQUEST.has(request.status)) {
    throw new CliExit(
      EXIT.NEEDS_USER_ACTION,
      `Still ${request.status}. The user must open ${request.approvalUrl}.`,
      "approval_pending",
    );
  }
}

function printRequest(ctx: CliContext, r: AgentCardRequest): void {
  ctx.out(`Agent card request ${pc.bold(r.id)} ${pc.dim("·")} ${statusColor(r.status)}`);
  for (const line of kv([
    ["Amount", formatAmount(r.amount.value, r.amount.currency)],
    ["Description", r.description],
    ["Merchant", r.merchant ? `${r.merchant.name} (${r.merchant.url})` : undefined],
    ["Requester", r.requester],
    ["Card expires", formatDate(r.expiresAt)],
    ["Answer by", formatDate(r.requestExpiresAt)],
    ["Agent card", r.agentCardId],
  ]))
    ctx.out(line);
  if (r.status === "pending" || r.status === "approved") {
    ctx.out("");
    ctx.out(pc.bold("Open this link to approve:"));
    ctx.out(`  ${pc.cyan(pc.underline(r.approvalUrl))}`);
    ctx.out("");
    ctx.out(
      pc.dim("Show this URL to the user verbatim. The request needs their approval in a browser."),
    );
  }
}

export function agentCardLines(card: AgentCard): string[] {
  const rails = card.rails.map((r) => `${describeRail(r)} [${r.status}]`).join("; ");
  return kv([
    ["Agent card", card.orderIntentId],
    ["Status", statusColor(card.status)],
    ["Description", card.description],
    [
      "Available",
      `${formatAmount(card.amount.available, card.amount.currency)} of ${formatAmount(card.amount.total, card.amount.currency)}`,
    ],
    [
      "Spent",
      card.amount.spent !== "0" && card.amount.spent !== "0.00"
        ? formatAmount(card.amount.spent, card.amount.currency)
        : undefined,
    ],
    ["Merchant", card.merchant ? `${card.merchant.name} (${card.merchant.url})` : undefined],
    ["Expires", formatDate(card.expiresAt)],
    ["Rails", rails || "none"],
    ["Payment method", card.paymentMethodId],
  ]);
}
