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
}

export class GoatError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GoatError";
    this.code = code;
  }
}
