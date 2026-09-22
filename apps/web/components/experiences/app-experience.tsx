"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStytch, useStytchSession, useStytchUser } from "@stytch/nextjs";
import { nanoid } from "nanoid";
import type { ConnectedAgentSession } from "@agent-commerce/ui";
import type { BrandTheme } from "@/components/brand-themes";
import { useAgentChat } from "@/components/chat/use-agent-chat";
import { BrandPicker } from "@/components/frame/brand-picker";
import { ViewSwitcher, type View } from "@/components/frame/view-switcher";
import { MESSAGING_APP_META, MESSAGING_APPS, type MessagingApp } from "@/components/frame/views";
import type { ChatMessage, ChatSummary } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { CliPanel } from "./cli-panel";
import { DesktopApp } from "./desktop-app";
import { McpPanel } from "./mcp-panel";
import { MessagingApp as MessagingAppView } from "./messaging-app";
import { MobileApp } from "./mobile-app";
import { brandAttr, type Choice, type ExperienceProps } from "./types";

export interface AppExperienceProps {
  email?: string;
  chats: ChatSummary[] | null;
  sessions: ConnectedAgentSession[];
  sessionsNote?: string;
  chatEnabled: boolean;
  attachmentsEnabled: boolean;
  persist: boolean;
  initialView: View;
  /** The `?app=` param, which chat app the messaging view imitates. */
  initialApp: MessagingApp;
  /** The `?brand=` param, the example brand the agent's pages wear. */
  initialBrand: BrandTheme;
  /** The `?chat=` param, a saved conversation to open. */
  initialChatId: string | null;
  /** An id for the conversation that starts here, minted by the server. */
  newChatId: string;
  revokeSession: (sessionId: string) => Promise<void>;
}

interface ThreadState {
  id: string;
  messages: ChatMessage[];
  /** True while the saved messages are being fetched. */
  loading: boolean;
  /** True once the server handed over the messages, so a sign-in does not fetch them twice. */
  loaded: boolean;
}

/** Where the bars fixed at the top of the page start, and the gap kept under them. */
const TOP_BAR_OFFSET = 24;
const TOP_BAR_GAP = 16;
/** What a phone keeps clear before the bars have been measured. */
const DEFAULT_RESERVE_TOP = 72;

/**
 * The client half of the app page: the switchers, the frame they name, and
 * the one conversation every frame shows.
 *
 * The URL is the contract: `?view=` is the frame, `?app=` the chat app the
 * messaging frame imitates, `?brand=` the example brand the agent's pages
 * wear, and `?chat=` a saved conversation. All live in state first, so a
 * switch is instant, and the URL is brought up to date with `router.replace`
 * afterwards. The chat's messages come from /api/chat/history/<id> on the
 * client, so the frame never waits on the server render.
 *
 * Signed-in state comes from Stytch on the client, so a login inside a frame
 * flips the interface without a reload; the email and the chat list come from
 * the server and arrive on the `router.refresh()` that follows.
 */
export function AppExperience({ email, chats, sessions, sessionsNote, chatEnabled, attachmentsEnabled, persist, initialView, initialApp, initialBrand, initialChatId, newChatId, revokeSession }: AppExperienceProps) {
  const router = useRouter();
  const stytch = useStytch();
  const { session, isInitialized } = useStytchSession();
  const { user } = useStytchUser();
  // Until the SDK has read its cookies, trust the server's answer.
  const signedIn = isInitialized ? Boolean(session) : Boolean(email);
  const shownEmail = signedIn ? (email ?? user?.emails?.[0]?.email) : undefined;

  const [choice, setChoice] = useState<Choice>({ view: initialView, app: initialApp, brand: initialBrand });
  const [thread, setThread] = useState<ThreadState>({
    id: initialChatId ?? newChatId,
    messages: [],
    loading: Boolean(initialChatId) && persist,
    loaded: false,
  });

  // Load a saved conversation's messages. A 401 leaves `loaded` false, so a
  // login later in the session tries again.
  useEffect(() => {
    if (!thread.loading) return;
    const id = thread.id;
    let cancelled = false;
    fetch(`/api/chat/history/${encodeURIComponent(id)}`)
      .then(async (res) => (res.ok ? { ok: true, messages: ((await res.json()) as { messages: ChatMessage[] }).messages } : { ok: false, messages: [] }))
      .catch(() => ({ ok: false, messages: [] as ChatMessage[] }))
      .then(({ ok, messages }) => {
        if (cancelled) return;
        setThread((t) => (t.id === id ? { ...t, messages, loading: false, loaded: ok } : t));
      });
    return () => {
      cancelled = true;
    };
  }, [thread.id, thread.loading]);

  // A conversation named in the URL while signed out could not be fetched.
  // Once the person signs in, fetch it. State adjusts during render, no effect.
  const [seenSignedIn, setSeenSignedIn] = useState(signedIn);
  if (seenSignedIn !== signedIn) {
    setSeenSignedIn(signedIn);
    if (signedIn && persist && initialChatId && thread.id === initialChatId && !thread.loaded && !thread.loading && thread.messages.length === 0) {
      setThread({ ...thread, loading: true });
    }
  }

  /**
   * Bring the URL up to date with the state. Reads the live URL, because the
   * chat hook writes `?chat=` itself. Defaults are left out, so the plain
   * `/app?view=mobile` stays plain.
   */
  const syncUrl = useCallback(
    (next: Partial<Choice> & { chat?: string | null }) => {
      const params = new URLSearchParams(window.location.search);
      if (next.view) params.set("view", next.view);
      if (next.app) {
        if (next.app === "imessage") params.delete("app");
        else params.set("app", next.app);
      }
      if (next.brand) {
        if (next.brand === "acme") params.delete("brand");
        else params.set("brand", next.brand);
      }
      if (next.chat !== undefined) {
        if (next.chat) params.set("chat", next.chat);
        else params.delete("chat");
      }
      router.replace(`/app?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const changeChoice = useCallback(
    (next: Partial<Choice>) => {
      setChoice((c) => ({ ...c, ...next }));
      syncUrl(next);
    },
    [syncUrl],
  );
  const changeView = useCallback((view: View) => view !== choice.view && changeChoice({ view }), [changeChoice, choice.view]);
  const changeApp = useCallback((app: MessagingApp) => app !== choice.app && changeChoice({ app }), [changeChoice, choice.app]);
  const changeBrand = useCallback((brand: BrandTheme) => brand !== choice.brand && changeChoice({ brand }), [changeChoice, choice.brand]);

  const openChat = useCallback(
    (id: string) => {
      if (id === thread.id) return;
      setThread({ id, messages: [], loading: persist, loaded: false });
      syncUrl({ chat: id });
    },
    [persist, syncUrl, thread.id],
  );

  const newChat = useCallback(() => {
    setThread({ id: nanoid(), messages: [], loading: false, loaded: false });
    syncUrl({ chat: null });
  }, [syncUrl]);

  const deleteChat = useCallback(
    async (id: string) => {
      await fetch(`/api/chat?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (id === thread.id) newChat();
      router.refresh();
    },
    [newChat, router, thread.id],
  );

  const onSignedIn = useCallback(() => router.refresh(), [router]);

  const onSignOut = useCallback(async () => {
    try {
      await stytch.session.revoke();
    } finally {
      // The next person at this browser gets a chat of their own.
      setThread({ id: nanoid(), messages: [], loading: false, loaded: false });
      syncUrl({ chat: null });
      router.refresh();
    }
  }, [router, stytch, syncUrl]);

  // The top bars can wrap onto two rows on a narrow desktop, or grow a row
  // for the messaging apps, so the phone measures them rather than guessing.
  const [topBar, setTopBar] = useState<HTMLDivElement | null>(null);
  const topBarHeight = useElementHeight(topBar);
  const reserveTop = topBarHeight ? TOP_BAR_OFFSET + topBarHeight + TOP_BAR_GAP : DEFAULT_RESERVE_TOP;

  const messaging = choice.view === "messaging";

  const shared = {
    ...choice,
    signedIn,
    email: shownEmail,
    onSignedIn,
    onSignOut,
    thread: { id: thread.id, loading: thread.loading },
    chats,
    onOpenChat: openChat,
    onNewChat: newChat,
    onDeleteChat: deleteChat,
    chatEnabled,
    attachmentsEnabled,
    sessions,
    sessionsNote,
    revokeSession,
    reserveTop,
  };

  return (
    <>
      {/* Desktop: the switchers fixed top centre, the app tabs under them when the messaging frame is up. */}
      <div ref={setTopBar} className="fixed inset-x-0 z-20 hidden flex-col items-center gap-2 md:flex" style={{ top: TOP_BAR_OFFSET }}>
        <div className="flex flex-wrap items-center justify-center gap-2 px-4">
          <ViewSwitcher value={choice.view} onChange={changeView} />
          <BrandPicker value={choice.brand} onChange={changeBrand} />
        </div>
        {messaging ? <MessagingAppTabs value={choice.app} onChange={changeApp} /> : null}
      </div>

      {/* Keyed so a change of conversation starts a fresh `useChat`. While the
          messages load, the key differs too, so they land as initial messages. */}
      <ChatHost key={thread.loading ? `${thread.id}:loading` : thread.id} id={thread.id} initialMessages={thread.messages} persist={persist} shared={shared} />

      {/* Phone: the same controls in a bar at the foot, in the flow so the frame above shrinks to fit. */}
      <div className="flex w-full shrink-0 flex-col items-center gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden">
        <ViewSwitcher value={choice.view} onChange={changeView} />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <BrandPicker value={choice.brand} onChange={changeBrand} size="sm" />
          {messaging ? <MessagingAppTabs value={choice.app} onChange={changeApp} size="sm" /> : null}
        </div>
      </div>
    </>
  );
}

/** Owns the chat, so a switch of frame keeps the conversation. */
function ChatHost({ id, initialMessages, persist, shared }: { id: string; initialMessages: ChatMessage[]; persist: boolean; shared: Omit<ExperienceProps, "chat"> }) {
  const chat = useAgentChat({ id, initialMessages, persist });
  const props: ExperienceProps = { ...shared, chat };
  const phone = shared.view === "mobile" || shared.view === "messaging";

  return (
    <div key={shared.view} className={cn("flex min-h-0 w-full flex-1 flex-col items-center justify-center", !phone && "px-4 md:px-0")}>
      {shared.view === "mobile" ? (
        <MobileApp {...props} />
      ) : shared.view === "desktop" ? (
        <DesktopApp {...props} />
      ) : shared.view === "messaging" ? (
        <MessagingAppView {...props} />
      ) : (
        // The panels are cards, not devices: the brand goes on the card itself, so the wrapper paints nothing of its own.
        <div data-brand={brandAttr(shared.brand)} className="contents">
          {shared.view === "mcp" ? <McpPanel {...props} /> : <CliPanel {...props} />}
        </div>
      )}
    </div>
  );
}

/** The three chat apps the messaging frame can imitate, as a pill of tabs in the switcher's style. */
function MessagingAppTabs({ value, onChange, size = "md" }: { value: MessagingApp; onChange: (app: MessagingApp) => void; size?: "sm" | "md" }) {
  return (
    <div role="tablist" aria-label="Chat app" className="flex items-center gap-1 rounded-full bg-card/70 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur-lg">
      {MESSAGING_APPS.map((app) => {
        const active = app === value;
        return (
          <button
            key={app}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(app)}
            className={cn(
              "rounded-full font-medium tracking-tight whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              size === "md" ? "h-9 px-4 text-sm" : "h-8 px-3 text-xs",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MESSAGING_APP_META[app].label}
          </button>
        );
      })}
    </div>
  );
}

/** The rendered height of an element, kept up to date as it changes. Zero while it is hidden or not yet mounted. */
function useElementHeight(el: HTMLElement | null): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!el) return;
    // Observing fires once at once, so the first measure needs no call of its own.
    const observer = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return height;
}
