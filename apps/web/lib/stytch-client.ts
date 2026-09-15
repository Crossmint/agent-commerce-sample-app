"use client";

import { createStytchUIClient, type StytchClient } from "@stytch/nextjs";

const token = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;

/**
 * One Stytch browser client for the app. The SDK is safe to create during
 * server rendering of client components. Null when the token is not set, so
 * the app can show a setup message instead of crashing.
 */
export const stytch: StytchClient | null = token ? createStytchUIClient(token) : null;

/**
 * Session length to request at login, in minutes. Default 7 days. Must not exceed
 * the project's maximum in the Stytch dashboard (SDK Configuration → Sessions).
 * Raise both together for long-lived agent logins.
 */
export const SESSION_MINUTES: number = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_STYTCH_SESSION_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 60 * 24 * 7;
})();

/** Fallback when the project maximum is lower than SESSION_MINUTES. */
export const FALLBACK_SESSION_MINUTES = 60;

export function isSessionDurationError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /invalid_session_duration/.test(msg);
}
