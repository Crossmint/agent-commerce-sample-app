const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

/** 21 url-safe random chars, same alphabet as nanoid. */
export function randomId(length = 21): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 63];
  return out;
}

export function agentCardRequestId(): string {
  return `acr_${randomId(21)}`;
}
