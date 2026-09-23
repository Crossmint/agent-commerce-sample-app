export class CrossmintApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly body: unknown;
  readonly url: string;

  constructor(opts: { status: number; url: string; body: unknown; message?: string }) {
    const bodyMessage =
      typeof opts.body === "object" && opts.body !== null && "message" in opts.body
        ? String((opts.body as { message: unknown }).message)
        : undefined;
    super(opts.message ?? bodyMessage ?? `Crossmint request failed with ${opts.status}`);
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
