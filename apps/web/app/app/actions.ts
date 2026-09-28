"use server";

import { revalidatePath } from "next/cache";
import { getSession, listSessions, revokeSession } from "@/lib/auth";

/** Revoke one of the signed-in user's sessions. Logs that agent or browser out. */
export async function revokeSessionAction(sessionId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const sessions = await listSessions(session.userId);
  if (!sessions.some((s) => s.session_id === sessionId)) throw new Error("That session is not yours.");
  await revokeSession(sessionId);
  revalidatePath("/app");
}
