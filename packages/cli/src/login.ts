import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import pc from "picocolors";
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCode,
  type PkcePair,
  type TokenResponse,
} from "@agent-commerce/auth";
import { randomState } from "@agent-commerce/auth";
import { fetchPublicConfig, AgentCommerceApi, withFetch } from "./api.js";
import { type AgentCommerceConfig, normalizeBaseUrl } from "./config.js";
import type { CliContext } from "./context.js";
import { fail, toJson } from "./output.js";
import type { PublicConfig } from "./types.js";

export interface LoginOptions {
  api?: string;
  /** Paste flow for shells without a local browser. */
  code?: boolean;
  json?: boolean;
  /** Milliseconds to wait for the browser callback. Default 5 minutes. */
  timeoutMs?: number;
}

const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60_000;

/**
 * OAuth 2.1 PKCE against Stytch Connected Apps.
 *
 * Default: loopback redirect. A one-shot HTTP server on 127.0.0.1 receives the
 * code, the same way `gh auth login` works.
 *
 * `--code`: for remote shells. The redirect goes to `${webBaseUrl}/cli-callback`,
 * a page the wallet website renders that shows the code. The user pastes the
 * code, or the whole redirect URL, back into the terminal.
 */
export async function login(ctx: CliContext, opts: LoginOptions): Promise<AgentCommerceConfig> {
  const apiBaseUrl = normalizeBaseUrl(
    opts.api ?? ctx.env.AGENT_COMMERCE_API_URL ?? ctx.config.read()?.apiBaseUrl,
  );
  if (!apiBaseUrl)
    throw fail(
      "No API URL. Pass --api <url>, e.g. `agent-commerce login --api https://wallet.example.com/api/agent-commerce`.",
    );

  let publicConfig: PublicConfig;
  try {
    publicConfig = await fetchPublicConfig(apiBaseUrl, ctx.fetch);
  } catch (e) {
    throw fail(`Could not read ${apiBaseUrl}/v1/config: ${(e as Error).message}`);
  }
  const oauth = publicConfig.auth?.oauth;
  const clientId = oauth?.cliClientId;
  if (!oauth?.authorizationEndpoint || !oauth.tokenEndpoint || !clientId) {
    throw fail(
      "This Agent Commerce server is not set up for CLI login. It needs STYTCH_PROJECT_DOMAIN and STYTCH_CLI_CLIENT_ID " +
        "(auth.oauth.authorizationEndpoint, tokenEndpoint, or cliClientId is missing in /v1/config).",
    );
  }

  const pkce = await createPkcePair();
  const state = randomState();
  const scope = oauth.scopes?.length
    ? oauth.scopes
    : ["openid", "email", "profile", "offline_access"];

  const grant = opts.code
    ? await pasteFlow(ctx, { publicConfig, clientId, pkce, state, scope })
    : await loopbackFlow(ctx, {
        publicConfig,
        clientId,
        pkce,
        state,
        scope,
        timeoutMs: opts.timeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS,
      });

  let token: TokenResponse;
  try {
    token = await withFetch(ctx.fetch, () =>
      exchangeCode({
        tokenEndpoint: oauth.tokenEndpoint,
        clientId,
        code: grant.code,
        redirectUri: grant.redirectUri,
        verifier: pkce.verifier,
      }),
    );
  } catch (e) {
    throw fail(`Login failed: ${(e as Error).message}`);
  }

  const config: AgentCommerceConfig = {
    apiBaseUrl: normalizeBaseUrl(publicConfig.apiBaseUrl) ?? apiBaseUrl,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(ctx.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    tokenEndpoint: oauth.tokenEndpoint,
    clientId,
  };
  ctx.config.write(config);

  const api = new AgentCommerceApi({
    config: { ...config, tokenFromEnv: false },
    fetch: ctx.fetch,
    store: ctx.config,
    now: ctx.now,
  });
  const me = await api.me();
  config.userId = me.userId;
  config.email = me.email;
  ctx.config.write(config);

  if (opts.json)
    ctx.out(toJson({ userId: me.userId, email: me.email, apiBaseUrl: config.apiBaseUrl }));
  else ctx.out(`${pc.green("Logged in as")} ${pc.bold(me.email ?? me.userId)}`);
  return config;
}

interface FlowInput {
  publicConfig: PublicConfig;
  clientId: string;
  pkce: PkcePair;
  state: string;
  scope: string[];
}

interface Grant {
  code: string;
  redirectUri: string;
}

async function loopbackFlow(
  ctx: CliContext,
  input: FlowInput & { timeoutMs: number },
): Promise<Grant> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const url = buildAuthorizeUrl({
    authorizeEndpoint: input.publicConfig.auth.oauth.authorizationEndpoint,
    clientId: input.clientId,
    redirectUri,
    scope: input.scope,
    state: input.state,
    pkce: input.pkce,
  });

  const codePromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          fail(
            "Timed out waiting for the browser. Run `agent-commerce login` again, or use `agent-commerce login --code`.",
          ),
        ),
      input.timeoutMs,
    );
    server.on("request", (req: IncomingMessage, res: ServerResponse) => {
      const reqUrl = new URL(req.url ?? "/", redirectUri);
      if (reqUrl.pathname !== "/callback") {
        res.writeHead(404).end("Not found");
        return;
      }
      const params = reqUrl.searchParams;
      const oauthError = params.get("error");
      if (oauthError) {
        // `access_denied` is the user saying no on the approval screen. It is
        // an answer, so it is not dressed up as a breakage.
        const denied = oauthError === "access_denied";
        if (denied) {
          html(res, 200, "Denied.", "The agent did not get a login.", "denied");
          clearTimeout(timer);
          reject(fail("Login denied. Nothing was granted."));
          return;
        }
        html(res, 400, "Login failed", `${oauthError}: ${params.get("error_description") ?? ""}`);
        clearTimeout(timer);
        reject(fail(`Login failed: ${oauthError} ${params.get("error_description") ?? ""}`.trim()));
        return;
      }
      if (params.get("state") !== input.state) {
        html(
          res,
          400,
          "Login failed",
          "State mismatch. Go back to the terminal and run `agent-commerce login` again.",
        );
        return;
      }
      const code = params.get("code");
      if (!code) {
        html(res, 400, "Login failed", "No code in the callback.");
        return;
      }
      html(res, 200, "Logged in", "You can close this window and return to the terminal.");
      clearTimeout(timer);
      resolve(code);
    });
  });

  ctx.err(`Opening your browser to log in to ${pc.bold(input.publicConfig.name ?? "Agent Commerce")}.`);
  ctx.err(`If it does not open, visit:\n\n  ${pc.cyan(url)}\n`);
  ctx.openBrowser(url).catch(() => {
    ctx.err(pc.yellow("Could not open a browser. Use the URL above, or run `agent-commerce login --code`."));
  });

  try {
    const code = await codePromise;
    return { code, redirectUri };
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
}

async function pasteFlow(ctx: CliContext, input: FlowInput): Promise<Grant> {
  const webBaseUrl = normalizeBaseUrl(input.publicConfig.webBaseUrl);
  if (!webBaseUrl) throw fail("This Agent Commerce server does not publish webBaseUrl, which --code needs.");
  const redirectUri = `${webBaseUrl}/cli-callback`;
  const url = buildAuthorizeUrl({
    authorizeEndpoint: input.publicConfig.auth.oauth.authorizationEndpoint,
    clientId: input.clientId,
    redirectUri,
    scope: input.scope,
    state: input.state,
    pkce: input.pkce,
  });
  ctx.err(`Open this URL in any browser and log in:\n\n  ${pc.cyan(url)}\n`);
  ctx.err("The page shows a code when you are done.");
  const answer = await ctx.prompt("Paste the code (or the full redirect URL): ");
  const parsed = parsePastedCode(answer);
  if (!parsed.code) throw fail("No code found in what you pasted.");
  if (parsed.state && parsed.state !== input.state)
    throw fail("State mismatch. Start `agent-commerce login --code` again and use the new URL.");
  return { code: parsed.code, redirectUri };
}

/** Accepts a bare code, a `code=...&state=...` query, or a full redirect URL. */
export function parsePastedCode(raw: string): { code?: string; state?: string } {
  const text = raw.trim();
  if (!text) return {};
  if (/^https?:\/\//i.test(text)) {
    try {
      const u = new URL(text);
      return {
        code: u.searchParams.get("code") ?? undefined,
        state: u.searchParams.get("state") ?? undefined,
      };
    } catch {
      return {};
    }
  }
  if (text.includes("code=")) {
    const params = new URLSearchParams(text.replace(/^\?/, ""));
    return { code: params.get("code") ?? undefined, state: params.get("state") ?? undefined };
  }
  return { code: text };
}

/*
 * The callback page. It is served by this local server, from a browser tab
 * the user did not ask for, so it has to look like the sign-in screen it
 * just came from, which follows the Crossmint onramp sample app: the white
 * ground with its dot grid, one white card with a hairline ring, the
 * Crossmint logotype, a 28px heading, one grey line, and a disc that says
 * how it went.
 *
 * Everything is inline. There is no asset server here, so the logotype is a
 * copy of `apps/web/public/crossmint.svg`, dark type with the gradient mark.
 * Type falls back to the system stack: a page shown once, for a few seconds,
 * is not worth a font download.
 */
const CROSSMINT = `<svg viewBox="0 0 459.17 85.97" width="117" height="22" aria-hidden="true"><defs><linearGradient id="xm-mark" x1=".12" y1=".13" x2="85.84" y2="85.84" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5edd4d"/><stop offset="1" stop-color="#05ce6c"/></linearGradient></defs><g fill="#222"><path d="M372.65,9.51c0-3.4,2.75-6.15,6.07-6.15s6.15,2.75,6.15,6.15-2.75,6.07-6.15,6.07-6.07-2.67-6.07-6.07Z"/><path d="M450.48,11.39v12.7h8.61v8.78h-8.61v19.26c0,3.67,1.62,5.2,5.29,5.2,1.36,0,2.98-.26,3.41-.34v8.18c-.6.26-2.47.94-6.05.94-7.67,0-12.44-4.6-12.44-12.36v-20.88h-7.67v-8.78h2.14s6.38,0,6.38,0v-6.26c0-.07,0-.15,0-.22v-6.22h8.95Z"/><path d="M112.53,55.81c1.9,3.29,4.49,5.91,7.78,7.86,3.34,1.9,7.09,2.85,11.25,2.85,3.03,0,5.83-.51,8.4-1.54,2.57-1.08,4.78-2.54,6.63-4.39,1.85-1.9,3.18-4.03,4.01-6.39l-8.86-4.01c-.77,2.16-2.05,3.88-3.85,5.16-1.8,1.28-3.9,1.93-6.32,1.93-2.21,0-4.19-.54-5.93-1.62-1.69-1.08-3.03-2.57-4.01-4.47-.98-1.9-1.46-4.08-1.46-6.55s.49-4.65,1.46-6.55c.98-1.9,2.31-3.39,4.01-4.47,1.75-1.08,3.72-1.62,5.93-1.62,2.36,0,4.44.64,6.24,1.93,1.85,1.28,3.16,2.98,3.93,5.08l8.86-3.85c-.82-2.52-2.18-4.67-4.08-6.47-1.85-1.85-4.06-3.29-6.63-4.31-2.57-1.08-5.34-1.62-8.32-1.62-4.16,0-7.91.95-11.25,2.85-3.29,1.9-5.88,4.49-7.78,7.78-1.9,3.29-2.85,7.01-2.85,11.17s.95,7.91,2.85,11.25Z"/><path d="M165.54,23.69h-9.48v41.91h10.09v-23.34c0-3.18.87-5.65,2.62-7.4,1.75-1.8,4.06-2.7,6.93-2.7h3.62v-8.94h-2.47c-2.93,0-5.44.62-7.55,1.85-1.58.95-2.83,2.45-3.77,4.51v-5.9Z"/><path fill-rule="evenodd" d="M202.9,22.81c12.44,0,21.57,9.29,21.57,21.99s-9.12,22.08-21.57,22.08-21.48-9.29-21.48-22.08,9.12-21.99,21.48-21.99ZM202.9,58.01c6.14,0,11.59-4.52,11.59-13.21s-5.46-13.04-11.59-13.04-11.59,4.43-11.59,13.04,5.54,13.21,11.59,13.21Z"/><path d="M236.39,51.96l-8.61,2.39c.51,4.69,5.11,12.53,17.13,12.53,10.57,0,15.68-6.99,15.68-13.3s-4.09-10.91-11.93-12.62l-6.31-1.28c-2.56-.51-4.18-2.13-4.18-4.35,0-2.56,2.47-4.77,5.97-4.77,5.54,0,7.33,3.84,7.67,6.22l8.35-2.39c-.68-4.09-4.43-11.59-16.02-11.59-8.61,0-15.26,6.14-15.26,13.38,0,5.71,3.84,10.48,11.17,12.1l6.14,1.36c3.32.68,4.86,2.39,4.86,4.6,0,2.56-2.13,4.77-6.22,4.77-5.28,0-8.1-3.32-8.44-7.07Z"/><path d="M263.91,54.35l8.61-2.39c.34,3.75,3.15,7.07,8.44,7.07,4.09,0,6.22-2.22,6.22-4.77,0-2.22-1.53-3.92-4.86-4.6l-6.14-1.36c-7.33-1.62-11.17-6.39-11.17-12.1,0-7.25,6.65-13.38,15.26-13.38,11.59,0,15.34,7.5,16.02,11.59l-8.35,2.39c-.34-2.39-2.13-6.22-7.67-6.22-3.49,0-5.97,2.22-5.97,4.77,0,2.22,1.62,3.84,4.18,4.35l6.31,1.28c7.84,1.7,11.93,6.48,11.93,12.62s-5.11,13.3-15.68,13.3c-12.02,0-16.62-7.84-17.13-12.53Z"/><path d="M312.63,23.69h-9.48v41.91h10.09v-24.58c0-1.85.33-3.44,1-4.78.67-1.34,1.62-2.36,2.85-3.08,1.23-.77,2.65-1.16,4.24-1.16s3.06.39,4.24,1.16c1.23.72,2.18,1.75,2.85,3.08.67,1.34,1,2.93,1,4.78v24.58h10.09v-24.58c0-1.85.33-3.44,1-4.78.67-1.34,1.62-2.36,2.85-3.08,1.23-.77,2.65-1.16,4.24-1.16,1.69,0,3.13.39,4.31,1.16,1.18.72,2.11,1.75,2.77,3.08.67,1.34,1,2.93,1,4.78v24.58h10.09v-26.96c0-3.13-.67-5.88-2-8.24-1.33-2.41-3.18-4.29-5.55-5.62-2.31-1.34-4.96-2-7.94-2-3.34,0-6.29.85-8.86,2.54-1.65,1.06-3.04,2.47-4.16,4.23-.92-1.58-2.2-2.94-3.85-4.07-2.62-1.8-5.65-2.7-9.09-2.7-3.13,0-5.85.74-8.17,2.23-1.51.97-2.69,2.28-3.54,3.91v-5.22Z"/><path d="M383.67,65.6h-9.8V24.09h9.8v41.51Z"/><path d="M392.54,24.08v41.51h10v-24.34c0-1.83.36-3.41,1.07-4.73.71-1.32,1.7-2.34,2.98-3.05,1.27-.76,2.72-1.14,4.35-1.14s3.13.38,4.35,1.14c1.27.71,2.26,1.73,2.98,3.05.71,1.32,1.07,2.9,1.07,4.73v24.34h10v-26.71c0-3.1-.66-5.83-1.98-8.17-1.32-2.39-3.18-4.25-5.57-5.57-2.34-1.32-5.04-1.98-8.09-1.98s-5.55.66-7.78,1.98c-1.68.98-3.01,2.32-3.97,4.03v-5.09h-9.39Z"/></g><path fill="url(#xm-mark)" fill-rule="evenodd" d="M70.01,48.33c-7.21-3.69-16.83-4.93-22.48-5.35,7.69-.57,22.74-2.66,29.04-10.38C86.43,25.22,85.96.25,85.96.25c0,0-23.66-2.61-33.99,9.17-6.42,6.39-8.41,17.49-8.99,25.22-.58-7.72-2.57-18.83-8.99-25.22C23.66-2.37,0,.25,0,.25,0,.25-.29,15.82,4.44,26.01c2.33,5.02,6.59,9.11,11.51,11.63,7.21,3.69,16.83,4.93,22.48,5.35-5.65.42-15.27,1.66-22.48,5.35-4.92,2.52-9.18,6.61-11.51,11.63C-.29,70.15,0,85.72,0,85.72c0,0,23.66,2.61,33.99-9.17,6.42-6.39,8.41-17.5,8.99-25.22.58,7.72,2.57,18.83,8.99,25.22,10.33,11.78,33.99,9.17,33.99,9.17,0,0,.3-15.57-4.44-25.76-2.33-5.02-6.59-9.11-11.51-11.63ZM70.8,70.17c-.12-.03-12.47-3.55-28.32-24.72-4.65,3.63-16.33,13.23-27.45,26.34l-.5.59.2-.75c.03-.13,3.65-12.85,25.7-29.05-2.13-3.16-7.14-10.43-26.48-27.56l-.43-.38.57.08c.41.06,10.35,1.62,28.51,25.02,0,0,.23.32.65.88,2.56-1.77,9.97-7.03,26.63-25.85l.38-.43-.08.57c-.06.41-1.62,10.3-24.87,28.39,4.39,5.54,13.47,16.24,25.65,26.56l.6.51-.75-.2Z"/></svg>`;

type CallbackTone = "ok" | "denied" | "error";

function html(res: ServerResponse, status: number, title: string, body: string, tone?: CallbackTone): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderCallbackPage(status, title, body, tone));
}

/** Exported for the test: the page above, as a string. */
export function renderCallbackPage(status: number, title: string, body: string, tone: CallbackTone = status < 400 ? "ok" : "error"): string {
  const ok = tone === "ok";
  // Success is the brand blue disc with a white check; anything else is a
  // quiet grey disc with a cross. A denial is an answer, not a fault, so it
  // is not painted red.
  const mark = ok
    ? `<span class="disc ok"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>`
    : `<span class="disc no"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span>`;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Agent Commerce Sample App: ${escapeHtml(title)}</title><style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 4rem 1rem; background-color: #fff; color: #171717;
    background-image: radial-gradient(rgba(200,195,189,0.4) 1px, transparent 1px); background-size: 28px 28px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased;
  }
  .card {
    width: 100%; max-width: 26rem; padding: 2rem 1.75rem 2.25rem; background: #fff;
    border-radius: 18px; box-shadow: 0 0 0 1px rgba(23,23,23,0.1);
  }
  .disc { display: inline-flex; width: 56px; height: 56px; margin-top: 2rem; align-items: center; justify-content: center; border-radius: 9999px; }
  .disc.ok { background: #4564FF; color: #fff; }
  .disc.no { background: #f2f2f2; color: #737373; }
  h1 { margin: 1.25rem 0 .5rem; font-size: 28px; line-height: 1.2; letter-spacing: -.02em; font-weight: 500; }
  p { margin: 0; color: #737373; font-size: 16px; line-height: 1.5; }
  p.hint { margin-top: 1.25rem; font-size: 14px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #171717; }
  svg { display: block; }
</style></head><body><main class="card">` +
      `<span role="img" aria-label="Crossmint">${CROSSMINT}</span>${mark}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>` +
      `${
        tone === "error"
          ? `<p class="hint">Go back to the terminal and run <code>agent-commerce login</code> again.</p>`
          : tone === "denied"
            ? `<p class="hint">You can close this tab. Run <code>agent-commerce login</code> again if you change your mind.</p>`
            : ""
      }` +
      `</main></body></html>`
  );
}

/** The title and body carry text from the OAuth server, so they are escaped. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Best-effort revoke of the refresh token at the OAuth server, then delete the config file. */
export async function logout(ctx: CliContext): Promise<{ revoked: boolean }> {
  const config = ctx.config.read();
  let revoked = false;
  if (config?.refreshToken && config.tokenEndpoint && config.clientId) {
    const revokeEndpoint = config.tokenEndpoint.replace(/\/token$/, "/revoke");
    if (revokeEndpoint !== config.tokenEndpoint) {
      try {
        const res = await ctx.fetch(revokeEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: config.refreshToken,
            token_type_hint: "refresh_token",
            client_id: config.clientId,
          }),
          signal: AbortSignal.timeout(5000),
        });
        revoked = res.ok;
      } catch {
        revoked = false;
      }
    }
  }
  ctx.config.clear();
  return { revoked };
}
