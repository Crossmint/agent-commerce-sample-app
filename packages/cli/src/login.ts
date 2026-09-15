import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import pc from "picocolors";
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCode,
  type PkcePair,
  type TokenResponse,
} from "@goat-wallet/auth";
import { randomState } from "@goat-wallet/auth";
import { fetchPublicConfig, GoatApi, withFetch } from "./api.js";
import { type GoatConfig, normalizeBaseUrl } from "./config.js";
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
export async function login(ctx: CliContext, opts: LoginOptions): Promise<GoatConfig> {
  const apiBaseUrl = normalizeBaseUrl(
    opts.api ?? ctx.env.GOAT_API_URL ?? ctx.config.read()?.apiBaseUrl,
  );
  if (!apiBaseUrl)
    throw fail(
      "No API URL. Pass --api <url>, e.g. `goat login --api https://wallet.example.com/api/goat`.",
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
      "This GOAT server has no CLI OAuth client configured (auth.oauth.cliClientId is missing in /v1/config).",
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

  const config: GoatConfig = {
    apiBaseUrl: normalizeBaseUrl(publicConfig.apiBaseUrl) ?? apiBaseUrl,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(ctx.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
    tokenEndpoint: oauth.tokenEndpoint,
    clientId,
  };
  ctx.config.write(config);

  const api = new GoatApi({
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
            "Timed out waiting for the browser. Run `goat login` again, or use `goat login --code`.",
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
          "State mismatch. Go back to the terminal and run `goat login` again.",
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

  ctx.err(`Opening your browser to log in to ${pc.bold(input.publicConfig.name ?? "GOAT")}.`);
  ctx.err(`If it does not open, visit:\n\n  ${pc.cyan(url)}\n`);
  ctx.openBrowser(url).catch(() => {
    ctx.err(pc.yellow("Could not open a browser. Use the URL above, or run `goat login --code`."));
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
  if (!webBaseUrl) throw fail("This GOAT server does not publish webBaseUrl, which --code needs.");
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
    throw fail("State mismatch. Start `goat login --code` again and use the new URL.");
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

function html(res: ServerResponse, status: number, title: string, body: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><html><head><meta charset="utf-8"><title>GOAT: ${title}</title>` +
      `<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#111}</style></head>` +
      `<body><h1>${title}</h1><p>${body}</p></body></html>`,
  );
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
