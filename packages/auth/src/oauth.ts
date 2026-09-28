/**
 * OAuth 2.1 PKCE helpers for agents (CLI, MCP) logging in through Stytch Connected Apps.
 * Pure Web Crypto, so this runs in Node, Bun, and the browser.
 */

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: "S256";
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)), method: "S256" };
}

export function randomState(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(16)));
}

export interface AuthorizeUrlInput {
  authorizeEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string[];
  state: string;
  pkce: PkcePair;
  extra?: Record<string, string>;
}

export function buildAuthorizeUrl(input: AuthorizeUrlInput): string {
  const url = new URL(input.authorizeEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scope.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.pkce.challenge);
  url.searchParams.set("code_challenge_method", input.pkce.method);
  for (const [k, v] of Object.entries(input.extra ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export async function exchangeCode(input: {
  tokenEndpoint: string;
  clientId: string;
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<TokenResponse> {
  return postToken(input.tokenEndpoint, {
    grant_type: "authorization_code",
    client_id: input.clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
  });
}

export async function refreshAccessToken(input: {
  tokenEndpoint: string;
  clientId: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  return postToken(input.tokenEndpoint, {
    grant_type: "refresh_token",
    client_id: input.clientId,
    refresh_token: input.refreshToken,
  });
}

async function postToken(endpoint: string, form: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(`Token request failed: ${body.error ?? res.status} ${body.error_description ?? ""}`.trim());
  }
  return body;
}

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
