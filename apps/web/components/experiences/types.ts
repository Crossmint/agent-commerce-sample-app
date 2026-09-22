import type { ConnectedAgentSession } from "@agent-commerce/ui";
import type { BrandTheme } from "@/components/brand-themes";
import type { AgentChat } from "@/components/chat/use-agent-chat";
import type { MessagingApp, View } from "@/components/frame/views";
import type { ChatSummary } from "@/lib/chat/types";

/** The one conversation open in the app, whatever frame shows it. */
export interface Thread {
  id: string;
  /** True while the saved messages are on their way from the server. */
  loading: boolean;
}

/** The three URL params a frame is chosen by. */
export interface Choice {
  view: View;
  /** Which chat app the messaging view imitates. */
  app: MessagingApp;
  /** The example brand the agent's own pages wear. */
  brand: BrandTheme;
}

/** What every frame gets: the person, their chat, their sessions, and the ways to change them. */
export interface ExperienceProps extends Choice {
  signedIn: boolean;
  /** Known once the server has seen the session. */
  email?: string;
  /** A login inside the frame finished. */
  onSignedIn: () => void;
  onSignOut: () => Promise<void>;
  chat: AgentChat;
  thread: Thread;
  /** Saved conversations, newest first. Null without a database or when chat is off. */
  chats: ChatSummary[] | null;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => Promise<void>;
  chatEnabled: boolean;
  attachmentsEnabled: boolean;
  sessions: ConnectedAgentSession[];
  sessionsNote?: string;
  revokeSession: (sessionId: string) => Promise<void>;
  /** Pixels a phone frame keeps clear above itself on a desktop, for the bars fixed at the top of the page. */
  reserveTop: number;
}

/** The `data-brand` value for a wrapper: nothing for the default brand, which is the page's own tokens. */
export function brandAttr(brand: BrandTheme): BrandTheme | undefined {
  return brand === "acme" ? undefined : brand;
}

/** Where a login inside the frame lands, so a Google round trip comes back to the same frame, app and brand. */
export function loginNext({ view, app, brand }: Choice): string {
  const params = new URLSearchParams({ view });
  if (view === "messaging" && app !== "imessage") params.set("app", app);
  if (brand !== "acme") params.set("brand", brand);
  return `/app?${params.toString()}`;
}

/** The first letter of the address, for an avatar. */
export function initialOf(email: string | undefined): string {
  return email?.trim().charAt(0).toUpperCase() || "?";
}
