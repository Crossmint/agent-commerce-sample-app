import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { ChatToolSet } from "./tools";

/** Tool names and their input/output types, for typed `tool-<name>` parts on the client. */
export type ChatTools = InferUITools<ChatToolSet>;

/** The one message type the client, the API route and the database share. */
export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

export type ChatMessagePart = ChatMessage["parts"][number];

/** A file the user attached, after upload to Vercel Blob. */
export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}
