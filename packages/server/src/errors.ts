import { CrossmintApiError, GoatError } from "@goat-wallet/core";
import type { ErrorBody } from "./types.js";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "expired"
  | "no_usable_rail"
  | "verification_required"
  | "merchant_required"
  | "crossmint_error"
  | "internal";

/** An error that already knows its HTTP status and JSON envelope. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toResponse(): Response {
    return errorResponse(this.status, this.code, this.message, this.details);
  }
}

export const unauthorized = (message = "Missing or invalid bearer token") =>
  new HttpError(401, "unauthorized", message);
export const forbidden = (message = "You do not own this resource") =>
  new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found") => new HttpError(404, "not_found", message);
export const invalidRequest = (message: string, details?: unknown) =>
  new HttpError(400, "invalid_request", message, details);

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorBody = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return json(body, status);
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** Turn anything thrown by a handler into the JSON error envelope. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) return err.toResponse();
  if (err instanceof CrossmintApiError) {
    const details = { status: err.status, body: err.body };
    // Always log Crossmint failures server side. Bodies carry no card data.
    console.warn(
      `[goat] crossmint ${err.status} ${err.url}:`,
      typeof err.body === "string" ? err.body.slice(0, 500) : JSON.stringify(err.body)?.slice(0, 500),
    );
    if (err.isUnauthorized) {
      return errorResponse(401, "unauthorized", "Crossmint rejected the user token", details);
    }
    if (err.isNotFound) {
      return errorResponse(404, "not_found", err.message, details);
    }
    const status = err.status >= 400 && err.status < 500 ? err.status : 502;
    return errorResponse(status, "crossmint_error", err.message, details);
  }
  if (err instanceof GoatError) {
    return errorResponse(400, err.code, err.message);
  }
  console.error("[goat] unhandled error", err);
  return errorResponse(500, "internal", "Internal error");
}
