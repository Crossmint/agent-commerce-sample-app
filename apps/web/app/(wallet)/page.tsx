import type { Metadata } from "next";
import type { ConnectedAgentSession } from "@goat-wallet/ui";
import { WalletHome } from "@/components/wallet-home";
import { getSession, listSessions } from "@/lib/auth";
import { revokeSessionAction } from "./actions";

export const metadata: Metadata = { title: "Wallet" };

export default async function HomePage() {
  const session = await getSession();
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

  return <WalletHome sessions={sessions} sessionsNote={sessionsNote} revokeSession={revokeSessionAction} />;
}

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
