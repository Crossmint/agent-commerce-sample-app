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
      "This GOAT server is not set up for CLI login. It needs STYTCH_PROJECT_DOMAIN and STYTCH_CLI_CLIENT_ID " +
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

/*
 * The callback page. It is served by this local server, from a browser tab
 * the user did not ask for, so it has to look like the sign-in screen it
 * just came from: the off-white ground with its dotted grid, the content in
 * one cell of hairlines with a green diamond at each corner, the wordmark
 * above it, and a disc that says how it went.
 *
 * Everything is inline. There is no asset server here, so the wordmark is
 * the outline copy of `apps/web/public/brand/goat-wordmark.svg` and the
 * diamond is the same path as `GridNode` in the web app. Type falls back to
 * the system stack: a page shown once, for a few seconds, is not worth a
 * font download.
 */
const NODE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 13.81 13.81'%3E%3Cpath fill='%2305B959' d='M4.99 1.09C5.85-.36 7.96-.36 8.83 1.09l1.17 1.96c.19.31.45.58.77.77l1.96 1.17c1.45.87 1.45 2.97 0 3.84l-1.96 1.17c-.32.19-.58.45-.77.77l-1.17 1.96c-.87 1.45-2.97 1.45-3.84 0l-1.17-1.96a2.2 2.2 0 0 0-.77-.77L1.09 8.83c-1.45-.87-1.45-2.97 0-3.84l1.96-1.17c.32-.19.58-.45.77-.77L4.99 1.09Z'/%3E%3C/svg%3E\")";

/* The Crossmint logotype, from `apps/web/public/logos/crossmint-gray.svg`.
   Its paths fill with `currentColor`, so the lockup colours it like the site. */
const CROSSMINT = `<svg viewBox="0 0 127 24" height="13" aria-hidden="true"><g clip-path="url(#clip0_4914_597)"><mask id="mask0_4914_597" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="127" height="24"><path d="M126.9 0H0V23.4H126.9V0Z" fill="white"/></mask><g mask="url(#mask0_4914_597)"><path d="M102.636 2.58819C102.636 1.66266 103.394 0.914062 104.307 0.914062C105.221 0.914062 106.002 1.66266 106.002 2.58819C106.002 3.51371 105.244 4.24053 104.307 4.24053C103.372 4.24053 102.636 3.51371 102.636 2.58819Z" fill="currentColor"/><path d="M124.071 3.09985V6.55688H126.442V8.94684H124.071V14.1895C124.071 15.1885 124.517 15.605 125.528 15.605C125.903 15.605 126.348 15.5343 126.467 15.5124V17.7391C126.302 17.8099 125.787 17.995 124.8 17.995C122.688 17.995 121.375 16.7428 121.375 14.6305V8.94684H119.263V6.55688H119.851H121.608V4.85286C121.608 4.83381 121.608 4.81203 121.608 4.79298V3.09985H124.073H124.071Z" fill="currentColor"/><path d="M30.9951 15.1915C31.5183 16.087 32.2316 16.8003 33.1377 17.331C34.0576 17.8482 35.0904 18.1068 36.2361 18.1068C37.0705 18.1068 37.8417 17.968 38.5495 17.6876C39.2573 17.3937 39.866 16.9962 40.3754 16.4927C40.885 15.9754 41.2512 15.3957 41.4798 14.7532L39.0397 13.6616C38.8277 14.2497 38.4752 14.7179 37.9794 15.0663C37.4836 15.4147 36.9053 15.5917 36.2388 15.5917C35.6302 15.5917 35.085 15.4446 34.6056 15.1507C34.1402 14.8567 33.7711 14.4511 33.5013 13.934C33.2314 13.4167 33.0992 12.8233 33.0992 12.1509C33.0992 11.4786 33.2341 10.8851 33.5013 10.368C33.7711 9.85076 34.1374 9.44522 34.6056 9.15119C35.0877 8.85721 35.6302 8.7103 36.2388 8.7103C36.8888 8.7103 37.4617 8.88447 37.9574 9.23561C38.4669 9.584 38.8277 10.0468 39.0397 10.6184L41.4798 9.57041C41.254 8.88446 40.8795 8.29923 40.3562 7.80925C39.8467 7.30567 39.238 6.9137 38.5302 6.63605C37.8224 6.34206 37.0596 6.19507 36.2388 6.19507C35.0931 6.19507 34.0603 6.45367 33.1405 6.97086C32.2344 7.48805 31.521 8.19307 30.9978 9.08864C30.4745 9.98414 30.2129 10.9968 30.2129 12.1292C30.2129 13.2615 30.4745 14.2824 30.9978 15.1915H30.9951Z" fill="currentColor"/><path d="M45.5944 6.44826H42.9834V17.8564H45.7623V11.5031C45.7623 10.6375 46.002 9.96519 46.4839 9.48882C46.9659 8.99883 47.6021 8.75389 48.3925 8.75389H49.3894V6.32031H48.7092C47.9023 6.32031 47.211 6.48909 46.6298 6.8239C46.1947 7.0825 45.8504 7.49081 45.5916 8.05156V6.44553L45.5944 6.44826Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M55.8845 6.20874C59.3107 6.20874 61.8252 8.73756 61.8252 12.1946C61.8252 15.6516 59.3134 18.2048 55.8845 18.2048C52.4557 18.2048 49.9688 15.6761 49.9688 12.1946C49.9688 8.71307 52.4805 6.20874 55.8845 6.20874ZM55.8845 15.7904C57.5755 15.7904 59.0765 14.56 59.0765 12.1946C59.0765 9.82908 57.5728 8.64496 55.8845 8.64496C54.1962 8.64496 52.6926 9.85086 52.6926 12.1946C52.6926 14.5382 54.2183 15.7904 55.8845 15.7904Z" fill="currentColor"/><path d="M65.1076 14.1434L62.7363 14.794C62.8769 16.0705 64.1437 18.2047 67.4541 18.2047C70.3653 18.2047 71.7726 16.302 71.7726 14.5843C71.7726 12.8667 70.6462 11.6145 68.487 11.1491L66.7491 10.8007C66.044 10.6618 65.5979 10.2209 65.5979 9.61661C65.5979 8.91968 66.2781 8.31814 67.2421 8.31814C68.7679 8.31814 69.2609 9.36344 69.3545 10.0113L71.6542 9.36065C71.4668 8.24736 70.4341 6.20581 67.2421 6.20581C64.8708 6.20581 63.0393 7.87716 63.0393 9.84791C63.0393 11.4022 64.0969 12.7007 66.1157 13.1416L67.8067 13.5118C68.7211 13.6969 69.1451 14.1624 69.1451 14.764C69.1451 15.4609 68.5585 16.0624 67.4322 16.0624C65.9779 16.0624 65.2013 15.1587 65.1076 14.1379V14.1434Z" fill="currentColor"/><path d="M72.6865 14.7939L75.0578 14.1433C75.1514 15.164 75.9253 16.0678 77.3823 16.0678C78.5086 16.0678 79.0952 15.4635 79.0952 14.7694C79.0952 14.165 78.674 13.7024 77.7568 13.5172L76.0658 13.147C74.047 12.7061 72.9895 11.4076 72.9895 9.85324C72.9895 7.87982 74.8209 6.21118 77.1922 6.21118C80.3842 6.21118 81.417 8.25273 81.6043 9.36607L79.3046 10.0167C79.211 9.36607 78.718 8.32351 77.1922 8.32351C76.231 8.32351 75.5481 8.9278 75.5481 9.62194C75.5481 10.2263 75.9941 10.6672 76.6992 10.8061L78.4371 11.1545C80.5963 11.6172 81.7227 12.9184 81.7227 14.5897C81.7227 16.2611 80.3154 18.2101 77.4042 18.2101C74.0939 18.2101 72.827 16.0759 72.6865 14.7993V14.7939Z" fill="currentColor"/><path d="M86.1044 6.44839H83.4932V17.8565H86.2719V11.1657C86.2719 10.6621 86.3634 10.2293 86.5478 9.86462C86.7322 9.49976 86.9936 9.2222 87.332 9.02618C87.6712 8.81661 88.0621 8.71038 88.5003 8.71038C88.9377 8.71038 89.3429 8.81661 89.6678 9.02618C90.0066 9.2222 90.2685 9.50255 90.453 9.86462C90.6375 10.2293 90.7275 10.6621 90.7275 11.1657V17.8565H93.5067V11.1657C93.5067 10.6621 93.5985 10.2293 93.783 9.86462C93.9675 9.49976 94.2285 9.2222 94.5669 9.02618C94.9062 8.81661 95.2968 8.71038 95.7351 8.71038C96.2004 8.71038 96.5973 8.81661 96.9222 9.02618C97.2471 9.2222 97.5036 9.50255 97.6854 9.86462C97.8699 10.2293 97.9599 10.6621 97.9599 11.1657V17.8565H100.739V10.5178C100.739 9.6659 100.555 8.91731 100.188 8.2749C99.822 7.61888 99.3135 7.10713 98.6601 6.74509C98.0238 6.38033 97.2939 6.20068 96.4731 6.20068C95.5533 6.20068 94.7415 6.43206 94.0332 6.89208C93.5787 7.18062 93.1953 7.56444 92.8875 8.04351C92.6337 7.61343 92.2809 7.24323 91.8264 6.93563C91.1055 6.44566 90.2712 6.20068 89.3235 6.20068C88.4614 6.20068 87.7127 6.40211 87.0731 6.80771C86.6577 7.07174 86.3328 7.42833 86.0985 7.87203V6.45111L86.1044 6.44839Z" fill="currentColor"/><path d="M105.669 17.8564H102.97V6.55713H105.669V17.8564Z" fill="currentColor"/><path d="M108.112 6.55463V17.8539H110.866V11.2284C110.866 10.7303 110.966 10.3002 111.162 9.94088C111.357 9.5816 111.63 9.30395 111.982 9.11063C112.332 8.9038 112.731 8.80035 113.18 8.80035C113.629 8.80035 114.042 8.9038 114.378 9.11063C114.727 9.30395 115.001 9.5816 115.199 9.94088C115.394 10.3002 115.494 10.7303 115.494 11.2284V17.8539H118.248V10.5833C118.248 9.73946 118.066 8.99632 117.702 8.35934C117.339 7.70878 116.826 7.20248 116.168 6.84317C115.524 6.48386 114.78 6.3042 113.94 6.3042C113.101 6.3042 112.413 6.48386 111.798 6.84317C111.335 7.10993 110.969 7.47469 110.704 7.94017V6.55463H108.118H108.112Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M19.2823 13.1552C17.2966 12.1508 14.6472 11.8132 13.0911 11.6989C15.209 11.5438 19.354 10.9749 21.089 8.87336C23.8045 6.86452 23.675 0.0675202 23.675 0.0675202C23.675 0.0675202 17.1589 -0.642939 14.314 2.56365C12.5458 4.30305 11.9978 7.32455 11.838 9.42867C11.6783 7.32727 11.1302 4.30305 9.36207 2.56365C6.51712 -0.645661 0.000952895 0.0675202 0.000952895 0.0675202C0.000952895 0.0675202 -0.0789157 4.30577 1.22377 7.07956C1.86547 8.44606 3.03871 9.55944 4.39373 10.2453C6.37942 11.2498 9.02889 11.5872 10.5849 11.7016C9.02889 11.816 6.37942 12.1534 4.39373 13.1579C3.03871 13.8439 1.86547 14.9572 1.22377 16.3237C-0.0789157 19.0948 0.000952895 23.333 0.000952895 23.333C0.000952895 23.333 6.51712 24.0435 9.36207 20.8369C11.1302 19.0975 11.6783 16.0733 11.838 13.9718C11.9978 16.0733 12.5458 19.0975 14.314 20.8369C17.1589 24.0435 23.675 23.333 23.675 23.333C23.675 23.333 23.7577 19.0948 22.4522 16.321C21.8106 14.9545 20.6374 13.8412 19.2823 13.1552ZM19.4998 19.1002C19.4669 19.0921 16.0655 18.1338 11.7004 12.3712C10.4197 13.3594 7.2029 15.9726 4.14035 19.5412L4.00264 19.7018L4.05773 19.4976C4.06598 19.4622 5.06297 15.9998 11.1357 11.59C10.5491 10.7298 9.16929 8.75093 3.8429 4.08802L3.72448 3.98457L3.88147 4.00635C3.99438 4.02269 6.73195 4.44732 11.7333 10.817C11.7333 10.817 11.7968 10.904 11.9124 11.0565C12.6174 10.5747 14.6582 9.14292 19.2465 4.01996L19.3512 3.90291L19.3291 4.05807C19.3127 4.16967 18.883 6.8618 12.4798 11.786C13.6888 13.2941 16.1895 16.2067 19.5439 19.0158L19.7092 19.1546L19.5026 19.1002H19.4998Z" fill="currentColor"/></g></g><defs><clipPath id="clip0_4914_597"><rect width="126.9" height="23.4" fill="white"/></clipPath></defs></svg>`;

const WORDMARK = `<svg viewBox="5.77 -150.48 457.22 144.72" height="26" aria-hidden="true"><title>GOAT</title><path fill="#32d55d" d="M97.66-136.72L97.66-126.95L107.42-126.95L107.42-107.42L87.89-107.42L87.89-117.19L78.13-117.19L78.13-126.95L39.06-126.95L39.06-117.19L29.30-117.19L29.30-39.06L39.06-39.06L39.06-29.30L78.13-29.30L78.13-39.06L87.89-39.06L87.89-68.36L58.59-68.36L58.59-87.89L107.42-87.89L107.42-29.30L97.66-29.30L97.66-19.53L87.89-19.53L87.89-9.77L29.30-9.77L29.30-19.53L19.53-19.53L19.53-29.30L9.77-29.30L9.77-126.95L19.53-126.95L19.53-136.72L29.30-136.72L29.30-146.48L87.89-146.48L87.89-136.72L97.66-136.72M195.31-117.19L195.31-126.95L156.25-126.95L156.25-117.19L146.48-117.19L146.48-39.06L156.25-39.06L156.25-29.30L195.31-29.30L195.31-39.06L205.08-39.06L205.08-117.19L195.31-117.19M136.72-136.72L146.48-136.72L146.48-146.48L205.08-146.48L205.08-136.72L214.84-136.72L214.84-126.95L224.61-126.95L224.61-29.30L214.84-29.30L214.84-19.53L205.08-19.53L205.08-9.77L146.48-9.77L146.48-19.53L136.72-19.53L136.72-29.30L126.95-29.30L126.95-126.95L136.72-126.95L136.72-136.72M263.67-97.66L263.67-68.36L322.27-68.36L322.27-97.66L312.50-97.66L312.50-107.42L302.73-107.42L302.73-117.19L283.20-117.19L283.20-107.42L273.44-107.42L273.44-97.66L263.67-97.66M263.67-48.83L263.67-9.77L244.14-9.77L244.14-107.42L253.91-107.42L253.91-117.19L263.67-117.19L263.67-126.95L273.44-126.95L273.44-136.72L283.20-136.72L283.20-146.48L302.73-146.48L302.73-136.72L312.50-136.72L312.50-126.95L322.27-126.95L322.27-117.19L332.03-117.19L332.03-107.42L341.80-107.42L341.80-9.77L322.27-9.77L322.27-48.83L263.67-48.83M400.39-9.77L400.39-126.95L361.33-126.95L361.33-146.48L458.98-146.48L458.98-126.95L419.92-126.95L419.92-9.77"/></svg>`;

type CallbackTone = "ok" | "denied" | "error";

function html(res: ServerResponse, status: number, title: string, body: string, tone?: CallbackTone): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderCallbackPage(status, title, body, tone));
}

/** Exported for the test: the page above, as a string. */
export function renderCallbackPage(status: number, title: string, body: string, tone: CallbackTone = status < 400 ? "ok" : "error"): string {
  const ok = tone === "ok";
  const mark = ok
    ? `<span class="disc ok"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>`
    : `<span class="disc no"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></span>`;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>GOAT: ${escapeHtml(title)}</title><style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 4rem 1rem; background-color: #f2f3ef; color: #0a1825;
    background-image: radial-gradient(rgba(10,24,37,.10) 1px, transparent 1px); background-size: 22px 22px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased;
  }
  .cell { position: relative; width: 100%; max-width: 28rem; padding: 2.75rem 2.25rem; }
  /* The rules bleed past the cell, as the grid does on the site. */
  .cell::before, .cell::after {
    content: ""; position: absolute; left: 50%; transform: translateX(-50%);
    width: 100vw; height: 1px; background: rgba(0,0,0,.2);
  }
  .cell::before { top: 0; } .cell::after { bottom: 0; }
  .v { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(0,0,0,.2); }
  .v.l { left: 0; } .v.r { right: 0; }
  .n { position: absolute; width: 14px; height: 14px; background-image: ${NODE}; background-size: contain; }
  .n.tl { top: -7px; left: -7px; } .n.tr { top: -7px; right: -7px; }
  .n.bl { bottom: -7px; left: -7px; } .n.br { bottom: -7px; right: -7px; }
  /* The lockup: the pixel wordmark, then "by" and the logotype in small, all
     sitting on one line, as in the app. */
  .lockup { display: flex; width: fit-content; align-items: flex-end; gap: 5px; color: #0a1825; }
  .lockup .by { font-size: 12px; line-height: 1; color: #5b6670; transform: translateY(-2px); }
  .lockup svg:last-child { transform: translateY(1px); }
  .disc { display: inline-flex; width: 56px; height: 56px; margin-top: 1.75rem; align-items: center; justify-content: center; border-radius: 9999px; }
  .disc.ok { background: #11ba4b; color: #fff; }
  .disc.no { background: rgba(10,24,37,.10); color: #5b6670; }
  h1 { margin: 1.5rem 0 .5rem; font-size: 2rem; line-height: 1.1; letter-spacing: -.03em; font-weight: 600; }
  p { margin: 0; color: #5b6670; line-height: 1.5; }
  p.hint { margin-top: 1.25rem; font-size: .875rem; }
  svg { display: block; }
</style></head><body><main class="cell">` +
      `<span class="v l"></span><span class="v r"></span>` +
      `<span class="n tl"></span><span class="n tr"></span><span class="n bl"></span><span class="n br"></span>` +
      `<span class="lockup" role="img" aria-label="GOAT by Crossmint">${WORDMARK}<span class="by">by</span>${CROSSMINT}</span>${mark}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>` +
      `${
        tone === "error"
          ? `<p class="hint">Go back to the terminal and run <code>goat login</code> again.</p>`
          : tone === "denied"
            ? `<p class="hint">You can close this tab. Run <code>goat login</code> again if you change your mind.</p>`
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
