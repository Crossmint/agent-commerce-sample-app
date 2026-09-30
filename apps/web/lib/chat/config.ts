import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { serverEnv } from "@/lib/env";

export type ChatProvider = "anthropic" | "openai";

const DEFAULT_MODEL: Record<ChatProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.6-luna",
};

/** Which provider has a key. Anthropic wins when both are set. */
export function chatProvider(): ChatProvider | null {
  if (serverEnv.optional("ANTHROPIC_API_KEY")) return "anthropic";
  if (serverEnv.optional("OPENAI_API_KEY")) return "openai";
  return null;
}

/** The chat half is on when a model provider has a key. The nav hides the link otherwise. */
export function chatEnabled(): boolean {
  return chatProvider() !== null;
}

/** Model id for the active provider. Override with CHAT_MODEL. */
export function chatModelId(): string {
  const provider = chatProvider() ?? "anthropic";
  return serverEnv.optional("CHAT_MODEL") ?? DEFAULT_MODEL[provider];
}

/** Build the model for the active provider. Throws when no key is set. */
export function chatModel(): LanguageModel {
  const provider = chatProvider();
  if (provider === "anthropic") {
    return createAnthropic({ apiKey: serverEnv.required("ANTHROPIC_API_KEY") })(chatModelId());
  }
  if (provider === "openai") {
    return createOpenAI({ apiKey: serverEnv.required("OPENAI_API_KEY") })(chatModelId());
  }
  throw new Error("Chat is off. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
}

/** Attachments upload to Vercel Blob. Off without a token; the attach button hides. */
export function attachmentsEnabled(): boolean {
  return Boolean(serverEnv.optional("BLOB_READ_WRITE_TOKEN"));
}

export { CHAT_REQUESTER } from "./requester";
