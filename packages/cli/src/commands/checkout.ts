import { readFileSync } from "node:fs";
import type { Command } from "commander";
import {
  asksPasswordInForm,
  type BuyerProfileInput,
  isTerminalCheckout,
  type PendingUserAction,
  pollUntil,
  toDecimalString,
} from "@agent-commerce/core";
import pc from "picocolors";
import type { AgentCommerceApi } from "../api.js";
import type { CliContext } from "../context.js";
import { CliExit, EXIT, fail, statusColor, toJson } from "../output.js";
import type { CheckoutMessageBody, CheckoutView, CreateCheckoutBody } from "../types.js";
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
  /** Optional: without one, the run's payment step asks the user to choose a payment method. */
  agentCard?: string;
  maxCost: number;
  currency: string;
  task?: string;
  purpose?: string;
  /** Older name for --task. */
  request?: string;
  buyerProfile?: string;
  browserProfile?: string;
  freshBrowser?: boolean;
  guidance?: string;
  wait?: boolean;
  timeout?: number;
}

interface WaitOptions extends JsonOption {
  wait?: boolean;
  timeout?: number;
}

interface AnswerOptions extends WaitOptions {
  values?: string;
  decline?: boolean;
  alternative?: string;
}

export function buildCheckoutBody(opts: CreateOptions): CreateCheckoutBody {
  const body: CreateCheckoutBody = {
    startUrl: opts.url,
    maxCost: { amount: toDecimalString(opts.maxCost), currency: opts.currency.toUpperCase() },
  };
  if (opts.agentCard) body.agentCardId = opts.agentCard;
  const task = opts.task ?? opts.request;
  if (task) body.task = task;
  if (opts.purpose) body.purpose = opts.purpose;
  if (opts.buyerProfile) body.buyerProfileId = opts.buyerProfile;
  if (opts.browserProfile) body.browserProfileId = opts.browserProfile;
  if (opts.freshBrowser) body.freshBrowser = true;
  if (opts.guidance) body.merchantGuidance = opts.guidance;
  return body;
}

/** Turn the answer flags into one message body. Exactly one of values, --decline, --alternative. */
export function buildAnswerBody(requestId: string, opts: AnswerOptions): CheckoutMessageBody {
  const picked = [
    opts.values !== undefined,
    Boolean(opts.decline),
    opts.alternative !== undefined,
  ].filter(Boolean).length;
  if (picked !== 1) {
    throw fail("Pass exactly one of --values <json>, --decline, or --alternative <text>.");
  }
  if (opts.decline) return { requestId, action: "decline" };
  if (opts.alternative !== undefined)
    return { requestId, action: "alternative", text: opts.alternative };
  return { requestId, action: "submit", values: parseJsonValues(opts.values!) };
}

export function registerCheckoutCommands(program: Command, ctx: CliContext): void {
  const co = program
    .command("checkout")
    .description("let Crossmint buy at a URL, paid with an agent card");

  const withWait = (cmd: Command) =>
    cmd
      .option(
        "--wait",
        "poll until done, blocked, failed, or something needs you: a question, or a payment method",
      )
      .option(
        "--timeout <s>",
        "with --wait: give up after this many seconds",
        parsePositiveNumber("--timeout"),
      );

  withJson(
    withWait(
      co
        .command("create")
        .description("start a checkout")
        .requiredOption("--url <url>", "product or cart URL to start from")
        .option(
          "--agent-card <id>",
          "pay from an agent card the user already approved; omit to let them choose a payment method at the payment step",
        )
        .requiredOption(
          "--max-cost <n>",
          "hard cap for the whole order, shipping and tax included",
          parseAmount("--max-cost"),
        )
        .option("--currency <code>", "ISO currency", "USD")
        .option("--task <text>", 'what to buy and how, e.g. "medium, black, cheapest shipping"')
        .option("--request <text>", "older name for --task")
        .option(
          "--purpose <text>",
          'what the purchase is, in a few words, shown when the user approves the payment, e.g. "Blue Pikachu pen"',
        )
        .option("--buyer-profile <id>", "buyer profile with name, contact and shipping")
        .option(
          "--browser-profile <id>",
          "a browser profile other than the user's own, which is attached by default",
        )
        .option("--fresh-browser", "start signed out, ignoring the user's saved merchant logins")
        .option("--guidance <text>", "notes about the store for the agent"),
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
    withWait(
      co.command("get <id>").description("show a checkout; exit 2 when it waits on an answer"),
    ),
  ).action(async (id: string, opts: WaitOptions) => {
    const api = getApi(ctx);
    let view = await api.getCheckout(id);
    if (opts.wait) view = await waitForCheckout(ctx, api, view, opts.timeout);
    report(ctx, view, opts.json);
  });

  withJson(
    withWait(
      co
        .command("answer <id> <requestId>")
        .description("answer the open question on a checkout")
        .option("--values <json>", "JSON object with one key per field")
        .option("--decline", "refuse the request")
        .option("--alternative <text>", 'suggest another way, e.g. "use the cheapest shipping"'),
    ),
  ).action(async (id: string, requestId: string, opts: AnswerOptions) => {
    const api = getApi(ctx);
    let view = await api.answerCheckout(id, buildAnswerBody(requestId, opts));
    if (opts.wait) view = await waitForCheckout(ctx, api, view, opts.timeout);
    report(ctx, view, opts.json);
  });

  withJson(
    withWait(
      co
        .command("message <id> <text>")
        .description("send the agent a note while the checkout runs"),
    ),
  ).action(async (id: string, text: string, opts: WaitOptions) => {
    const api = getApi(ctx);
    let view = await api.answerCheckout(id, { text });
    if (opts.wait) view = await waitForCheckout(ctx, api, view, opts.timeout);
    report(ctx, view, opts.json);
  });

  withJson(co.command("cancel <id>").description("stop a checkout")).action(
    async (id: string, opts: JsonOption) => {
      const api = getApi(ctx);
      const view = await api.cancelCheckout(id);
      if (opts.json) ctx.out(toJson(view));
      else {
        for (const line of checkoutSummary(view)) ctx.out(line);
        ctx.out(
          pc.dim(
            "Cancel requested. The checkout reaches cancelled on a later `agent-commerce checkout get`.",
          ),
        );
      }
    },
  );

  const bp = program
    .command("buyer-profile")
    .description("name, contact and shipping details for checkouts");
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

/**
 * Poll until the run ends, a question appears, or it reaches its payment step.
 * The store's own card form never reaches the CLI: the payment step is a link
 * the user opens to choose a payment method, so waiting past it is pointless.
 */
async function waitForCheckout(
  ctx: CliContext,
  api: AgentCommerceApi,
  initial: CheckoutView,
  timeoutS: number | undefined,
): Promise<CheckoutView> {
  const done = (v: CheckoutView) =>
    isTerminalCheckout(v) ||
    pendingAction(v) !== undefined ||
    v.paymentRequest !== undefined ||
    v.passwordRequest !== undefined ||
    passwordInForm(v) !== undefined;
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
        `Timed out while ${last.status}. Check later with \`agent-commerce checkout get ${last.id} --wait\`.`,
        "timeout",
      );
    }
    throw e;
  }
  return last;
}

/** The open request, when it asks for a password in a plain form. */
function passwordInForm(view: CheckoutView): PendingUserAction | undefined {
  const pending = view.pendingUserAction as PendingUserAction | undefined;
  return pending && asksPasswordInForm(pending) ? pending : undefined;
}

/** Print the view. Exit 2 with instructions when a question waits, 1 when the run did not buy. */
function report(ctx: CliContext, view: CheckoutView, json: boolean | undefined): void {
  const action = pendingAction(view);
  const payment = view.paymentRequest;
  const password = view.passwordRequest;
  const formPassword = passwordInForm(view);
  if (json) {
    ctx.out(toJson(view));
  } else {
    for (const line of checkoutSummary(view)) ctx.out(line);
    if (view.embedUrl) ctx.out(`  ${pc.dim("Watch:")}    ${view.embedUrl}`);
    if (payment) {
      // The run cannot pay until somebody picks a card. Nothing to answer
      // here: the choice happens in a browser, and the server pays from it.
      ctx.out("");
      ctx.out(`  ${pc.bold("Payment step.")} Open this to choose a payment method:`);
      ctx.out(`  ${payment.approvalUrl}`);
      ctx.out(
        `  ${pc.dim(`It mints an agent card for up to ${payment.amount.value} ${payment.amount.currency}. Then run: agent-commerce checkout get ${view.id} --wait`)}`,
      );
    }
    if (password) {
      // A secret never goes through the CLI: the user types it in a browser.
      ctx.out("");
      ctx.out(
        `  ${pc.bold("Password needed.")} ${password.merchantDomain ?? "The store"} asks for the password of your account there. Open this to type it into a secure field:`,
      );
      ctx.out(`  ${password.url}`);
      ctx.out(
        `  ${pc.dim(`Never pass the password to this CLI. Then run: agent-commerce checkout get ${view.id} --wait`)}`,
      );
    }
    if (formPassword) {
      ctx.out("");
      ctx.out(
        `  ${pc.bold("Password asked in a form.")} The store wants the user to sign in, but asks in a plain form, which is never filled in. Do not ask for the password and never pass it to this CLI.`,
      );
      ctx.out(
        `  ${pc.dim(`Offer a guest checkout: agent-commerce checkout answer ${view.id} ${formPassword.id} --alternative "check out as a guest". Or --decline.`)}`,
      );
    }
    if (action) {
      ctx.out("");
      for (const line of describeAction(view.id, action)) ctx.out(line);
    }
  }
  if (formPassword && !action) {
    throw new CliExit(
      EXIT.NEEDS_USER_ACTION,
      json
        ? `Checkout ${view.id} asks for a password in a plain form (request ${formPassword.id}). Decline it or suggest a guest checkout.`
        : "",
      "password_in_form",
    );
  }
  if (password && !action) {
    throw new CliExit(
      EXIT.NEEDS_USER_ACTION,
      json ? `Checkout ${view.id} is waiting for the user's password at ${password.url}.` : "",
      "password_needed",
    );
  }
  if (payment && !action) {
    throw new CliExit(
      EXIT.NEEDS_USER_ACTION,
      json ? `Checkout ${view.id} is waiting for a payment method at ${payment.approvalUrl}.` : "",
      "payment_method_needed",
    );
  }
  if (action) {
    throw new CliExit(
      EXIT.NEEDS_USER_ACTION,
      json ? `Checkout ${view.id} needs an answer to request ${action.id}.` : "",
      "action_needed",
    );
  }
  if (view.status === "failed" || view.status === "blocked" || view.status === "cancelled") {
    const reason = view.failure
      ? `${view.failure.reason}${view.failure.message ? `: ${view.failure.message}` : ""}`
      : view.status;
    throw new CliExit(EXIT.ERROR, `Checkout ${view.status}: ${reason}`, view.status);
  }
}
