import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { bearerToken } from "../src/types.js";
import { createJwksUserAuth } from "../src/generic-jwks.js";
import { buildAuthorizeUrl, createPkcePair } from "../src/oauth.js";
import { stytchEndpoints } from "../src/stytch.js";

describe("bearerToken", () => {
  it("reads the Authorization header", () => {
    expect(bearerToken(new Headers({ Authorization: "Bearer abc" }))).toBe("abc");
    expect(bearerToken(new Headers())).toBeNull();
  });
});

describe("createJwksUserAuth", () => {
  it("verifies a token against a JWKS", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
    const jwt = await new SignJWT({ email: "a@b.c" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setSubject("user-1")
      .setIssuer("me")
      .setAudience("goat")
      .setExpirationTime("5m")
      .sign(privateKey);
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } })) as typeof fetch;
    try {
      const auth = createJwksUserAuth({ jwksUrl: "https://example.test/jwks", issuer: "me", audience: "goat" });
      const user = await auth.verify(jwt);
      expect(user?.userId).toBe("user-1");
      expect(user?.email).toBe("a@b.c");
      expect(await auth.verify("garbage")).toBeNull();
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe("oauth + stytch endpoints", () => {
  it("builds a PKCE authorize URL", async () => {
    const pkce = await createPkcePair();
    const ep = stytchEndpoints({ projectId: "project-test-123", authorizationUrl: "https://wallet.test/oauth/authorize" });
    const url = new URL(buildAuthorizeUrl({ authorizeEndpoint: ep.authorize!, clientId: "c", redirectUri: "http://127.0.0.1:1/cb", scope: ["openid"], state: "s", pkce }));
    expect(url.origin).toBe("https://wallet.test");
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(ep.environment).toBe("test");
    expect(ep.token).toBe("https://test.stytch.com/v1/public/project-test-123/oauth2/token");
    expect(ep.idpJwks).toBe("https://test.stytch.com/v1/public/project-test-123/.well-known/jwks.json");
    expect(stytchEndpoints({ projectId: "project-test-123", projectDomain: "auth.example.com" }).token).toBe("https://auth.example.com/oauth2/token");
  });
});
