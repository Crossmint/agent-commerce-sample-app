import type { Metadata } from "next";
import { nanoid } from "nanoid";
import { Chat } from "@/components/chat/chat";
import { attachmentsEnabled } from "@/lib/chat/config";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = { title: "Chat" };

/** A new chat. The id is minted here; the URL picks it up on the first message. */
export default function NewChatPage() {
  return <Chat id={nanoid()} initialMessages={[]} persist={isDatabaseConfigured()} attachmentsEnabled={attachmentsEnabled()} />;
}
