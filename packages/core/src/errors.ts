export class CrossmintApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly body: unknown;
  readonly url: string;

  constructor(opts: { status: number; url: string; body: unknown; message?: string }) {
    super(opts.message ?? bodyMessage(opts.body) ?? `Crossmint request failed with ${opts.status}`);
    this.name = "CrossmintApiError";
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
    this.code =
      typeof opts.body === "object" && opts.body !== null && "code" in opts.body
        ? String((opts.body as { code: unknown }).code)
        : undefined;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /**
   * The mint was refused because the vault's copy of the saved card's security
   * code lapsed. The rail's own status says the same thing, but a card that
   * was fine when the order intent was read can lapse before the mint lands,
   * so this is the second place the case shows up.
   */
  get isCvcRecollectionRequired(): boolean {
    return this.status === 409 && this.code === CVC_RECOLLECTION_REQUIRED;
  }
}

/**
 * The message in an error body, wherever Crossmint puts it: top-level
 * `message`, or nested under `error`, `provider`/`providerError`, or
 * `details` — a 502's real reason sits in one of these, not in the status.
 */
function bodyMessage(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const record = body as Record<string, unknown>;
  const at = (obj: unknown, ...keys: string[]): string | undefined => {
    if (typeof obj !== "object" || obj === null) return undefined;
    const rec = obj as Record<string, unknown>;
    for (const key of keys) {
      const value = rec[key];
      if (typeof value === "string" && value.length > 0) return value;
      // NestJS-style validation errors carry message: string[].
      if (Array.isArray(value)) {
        const joined = value
          .filter((v): v is string => typeof v === "string" && v.length > 0)
          .join("; ");
        if (joined) return joined;
      }
      if (typeof value === "object" && value !== null) {
        const nested = at(value, "message", "detail", "error");
        if (nested) return nested;
      }
    }
    return undefined;
  };
  return at(record, "message") ?? at(record, "error", "provider", "providerError", "details");
}

/** Crossmint's code for a mint that needs the security code typed again. */
export const CVC_RECOLLECTION_REQUIRED = "ORDER_INTENT_CVC_RECOLLECTION_REQUIRED";

export class AgentCommerceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AgentCommerceError";
    this.code = code;
  }
}
