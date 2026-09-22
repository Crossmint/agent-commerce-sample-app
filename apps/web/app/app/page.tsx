import type { Metadata } from "next";
import { nanoid } from "nanoid";
import type { ConnectedAgentSession } from "@agent-commerce/ui";
import { AppExperience } from "@/components/experiences/app-experience";
import { FramePage } from "@/components/frame/frame-page";
import { DEFAULT_BRAND_THEME, isBrandTheme, type BrandTheme } from "@/components/brand-themes";
import { isMessagingApp, parseView, type MessagingApp, type View } from "@/components/frame/views";
import { getSession, listSessions } from "@/lib/auth";
import { attachmentsEnabled, chatEnabled } from "@/lib/chat/config";
import type { ChatSummary } from "@/lib/chat/types";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { listChats } from "@/lib/db/queries";
import { revokeSessionAction } from "./actions";

export const metadata: Metadata = { title: "App" };
export const dynamic = "force-dynamic";

/**
 * The product page: one agent commerce chat, shown through five frames. The
 * page is public; a visitor signs in inside whichever frame they picked.
 *
 * The URL carries the state a link should keep: `?view=` names the frame,
 * `?app=` the chat app the messaging frame imitates, `?brand=` the example
 * brand the agent's pages wear, and `?chat=` a saved conversation. The chat's
 * messages are loaded on the client from /api/chat/history/<id>, so this page
 * only needs the list.
 */
export default async function AppPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view: View = parseView(str(params.view));
  const rawApp = str(params.app);
  const app: MessagingApp = isMessagingApp(rawApp) ? rawApp : "imessage";
  const rawBrand = str(params.brand);
  const brand: BrandTheme = isBrandTheme(rawBrand) ? rawBrand : DEFAULT_BRAND_THEME;
  const chatParam = typeof params.chat === "string" && params.chat ? params.chat : null;

  const session = await getSession();
  const enabled = chatEnabled();
  const persist = isDatabaseConfigured();

  let chats: ChatSummary[] | null = null;
  const db = getDb();
  if (session && enabled && db) {
    try {
      chats = (await listChats(db, session.userId)).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
    } catch (e) {
      console.error("[app] could not list chats", e);
      chats = [];
    }
  }

  let sessions: ConnectedAgentSession[] = [];
  let sessionsNote: string | undefined;
  if (session) {
    try {
      const all = await listSessions(session.userId);
      sessions = all
        .map((s) => ({
          id: s.session_id,
          label: labelFor(s.attributes?.user_agent, s.custom_claims),
          lastActive: s.last_accessed_at ?? s.started_at,
          current: s.session_id === session.sessionId,
          agent: !s.attributes?.user_agent?.includes("Mozilla"),
        }))
        .sort((a, b) => Number(b.current) - Number(a.current));
    } catch {
      // Needs STYTCH_SECRET. Show the current session only.
      sessionsNote = "Set STYTCH_SECRET to list every connected agent.";
      sessions = [{ id: session.sessionId ?? "current", label: "This browser", current: true }];
    }
  }

  return (
    <FramePage>
      <AppExperience
        email={session?.email}
        chats={chats}
        sessions={sessions}
        sessionsNote={sessionsNote}
        chatEnabled={enabled}
        attachmentsEnabled={attachmentsEnabled()}
        persist={persist}
        initialView={view}
        initialApp={app}
        initialBrand={brand}
        initialChatId={chatParam}
        // Minted per request: a new chat gets its id before the first message.
        newChatId={nanoid()}
        revokeSession={revokeSessionAction}
      />
    </FramePage>
  );
}

/** A search param as one string, or nothing. */
function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** "Claude Code", "Chrome on macOS", "Agent". */
function labelFor(userAgent: string | undefined, claims: Record<string, unknown> | undefined): string {
  const name = claims && typeof claims.client_name === "string" ? claims.client_name : undefined;
  if (name) return name;
  if (!userAgent) return "Agent";
  if (!userAgent.includes("Mozilla")) return userAgent.split("/")[0] || "Agent";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Safari\//.test(userAgent)
        ? "Safari"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : "Browser";
  const os = /Mac OS X/.test(userAgent)
    ? "macOS"
    : /Windows/.test(userAgent)
      ? "Windows"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
