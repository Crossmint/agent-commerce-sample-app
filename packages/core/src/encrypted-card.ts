import { compactDecrypt, exportJWK, generateKeyPair, importJWK, type JWK } from "jose";
import type { CardCredentialValue, RsaPublicJwk } from "./types.js";

export interface EncryptedCardKeyPair {
  /** Full private JWK. Keep it on the server. */
  privateJwk: JWK;
  /** Public JWK trimmed to the three fields Crossmint accepts. */
  publicJwk: RsaPublicJwk;
}

/**
 * Generate an RSA key pair for the encrypted-card rail.
 * Crossmint returns the card as a JWE encrypted to this public key.
 */
export async function generateEncryptedCardKeyPair(
  modulusLength: 2048 | 3072 | 4096 = 2048,
): Promise<EncryptedCardKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair("RSA-OAEP-256", {
    modulusLength,
    extractable: true,
  });
  const privateJwk = await exportJWK(privateKey);
  const pub = await exportJWK(publicKey);
  return { privateJwk, publicJwk: toPublicJwk(pub) };
}

export function toPublicJwk(jwk: JWK): RsaPublicJwk {
  if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) throw new Error("Not an RSA JWK");
  return { kty: "RSA", n: jwk.n, e: jwk.e };
}

/** Parse a private JWK from an env var (JSON string or base64url JSON). */
export function parsePrivateJwk(raw: string): JWK {
  const trimmed = raw.trim();
  const json = trimmed.startsWith("{") ? trimmed : base64urlDecode(trimmed);
  const jwk = JSON.parse(json) as JWK;
  if (jwk.kty !== "RSA") throw new Error("Encrypted-card key must be an RSA JWK");
  return jwk;
}

/**
 * Decrypt the `credential.value` of an encrypted-card credential.
 * Tries RSA-OAEP-256 first, then RSA-OAEP, since the JWE header decides.
 */
export async function decryptEncryptedCard(
  jwe: string,
  privateJwk: JWK,
): Promise<CardCredentialValue> {
  const key = await importJWK(privateJwk, privateJwk.alg ?? "RSA-OAEP-256");
  const { plaintext } = await compactDecrypt(jwe, key);
  const text = new TextDecoder().decode(plaintext);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return normalizeCard(parsed);
}

function normalizeCard(raw: Record<string, unknown>): CardCredentialValue {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === "string" || typeof v === "number") return String(v);
    }
    return "";
  };
  return {
    number: pick("number", "pan", "cardNumber"),
    expirationMonth: pick("expirationMonth", "expMonth", "exp_month"),
    expirationYear: pick("expirationYear", "expYear", "exp_year"),
    cvc: pick("cvc", "cvv", "securityCode"),
  };
}

function base64urlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
