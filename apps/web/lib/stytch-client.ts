"use client";

import { createStytchUIClient, type StytchClient } from "@stytch/nextjs";

const token = process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN;

/**
 * One Stytch browser client for the app. The SDK is safe to create during
 * server rendering of client components. Null when the token is not set, so
 * the app can show a setup message instead of crashing.
 */
export const stytch: StytchClient | null = token ? createStytchUIClient(token) : null;
