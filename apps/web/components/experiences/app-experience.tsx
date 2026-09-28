"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStytch, useStytchSession, useStytchUser } from "@stytch/nextjs";
import { nanoid } from "nanoid";
import type { ConnectedAgentSession } from "@agent-commerce/ui";
import { AgentsLockup } from "@/components/brand";
import type { BrandTheme } from "@/components/brand-themes";
import { useAgentChat } from "@/components/chat/use-agent-chat";
import { FrameControls } from "@/components/frame/frame-selects";
import { SiteHeader } from "@/components/frame/site-header";
import { type MessagingApp, type View } from "@/components/frame/views";
import type { ChatMessage, ChatSummary } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
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

/**
 * What a desktop keeps clear above the phone: the header block at the top
 * left (24px down, the 52px card row, an 8px gap, the 26px notice under it)
 * and a gap below it. A fixed figure now that the controls no longer stack
 * over the phone.
 */
const RESERVE_TOP = 24 + 52 + 8 + 26 + 16;

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
export function AppExperience({
  email,
  chats,
  sessions,
  sessionsNote,
  chatEnabled,
  attachmentsEnabled,
  persist,
  initialView,
  initialApp,
  initialBrand,
  initialChatId,
  newChatId,
  revokeSession,
}: AppExperienceProps) {
  const router = useRouter();
  const stytch = useStytch();
  const { session, isInitialized } = useStytchSession();
  const { user } = useStytchUser();
  // Until the SDK has read its cookies, trust the server's answer.
  const signedIn = isInitialized ? Boolean(session) : Boolean(email);
  const shownEmail = signedIn ? (email ?? user?.emails?.[0]?.email) : undefined;

  const [choice, setChoice] = useState<Choice>({
    view: initialView,
    app: initialApp,
    brand: initialBrand,
  });
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
      .then(async (res) =>
        res.ok
          ? { ok: true, messages: ((await res.json()) as { messages: ChatMessage[] }).messages }
          : { ok: false, messages: [] },
      )
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
    if (
      signedIn &&
      persist &&
      initialChatId &&
      thread.id === initialChatId &&
      !thread.loaded &&
      !thread.loading &&
      thread.messages.length === 0
    ) {
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
  const changeView = useCallback(
    (view: View) => view !== choice.view && changeChoice({ view }),
    [changeChoice, choice.view],
  );
  const changeBrand = useCallback(
    (brand: BrandTheme) => brand !== choice.brand && changeChoice({ brand }),
    [changeChoice, choice.brand],
  );
  /**
   * Picking a chat app moves to the messaging platform and names the app in
   * one change. Two calls would race in the URL: `syncUrl` reads the current
   * search each time, so the second would write back the search from before
   * the first and drop the app.
   */
  const changeMessagingApp = useCallback(
    (app: MessagingApp) => changeChoice({ view: "messaging", app }),
    [changeChoice],
  );

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

  const reserveTop = RESERVE_TOP;
  const controls = {
    view: choice.view,
    app: choice.app,
    brand: choice.brand,
    onView: changeView,
    onApp: changeMessagingApp,
    onBrand: changeBrand,
  };

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
      {/* Desktop: one header row, the logo card and the controls beside it. */}
      <div className="fixed top-6 left-6 z-20 hidden flex-col items-start gap-2 md:flex">
        <div className="flex items-center gap-2.5">
          <SiteHeader />
          <FrameControls {...controls} animate />
        </div>
        {/* The app runs on production keys, so anything bought here is bought. */}
        <p className="rounded-full border border-border bg-background/80 px-3 py-1 text-[12px] font-medium text-muted-foreground backdrop-blur">
          All purchases are real purchases.
        </p>
      </div>

      {/*
        Phone: the logo card is desktop-only, so the way back to the landing
        page is a banner of its own. In the flow, so the frame below it
        shrinks to fit rather than sitting under it.
      */}
      <div className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5 md:hidden">
        <Link
          href="/"
          aria-label="Agents by Crossmint home page"
          className="flex min-w-0 items-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AgentsLockup size={20} />
        </Link>
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
          All purchases are real
        </span>
      </div>

      {/* Not keyed by the conversation: the frame stays mounted when another
          chat opens, and the chat hook starts the new one itself. */}
      <ChatHost
        id={thread.id}
        initialMessages={thread.messages}
        persist={persist}
        shared={shared}
      />

      {/*
        Phone: no controls; the app fills the screen as the app it is. Only
        the home indicator's strip is kept clear, so the composer is not under it.
      */}
      <div aria-hidden className="h-[env(safe-area-inset-bottom)] w-full shrink-0 md:hidden" />
    </>
  );
}

/** Owns the chat, so a switch of frame keeps the conversation. */
function ChatHost({
  id,
  initialMessages,
  persist,
  shared,
}: {
  id: string;
  initialMessages: ChatMessage[];
  persist: boolean;
  shared: Omit<ExperienceProps, "chat">;
}) {
  const chat = useAgentChat({ id, initialMessages, persist });
  const props: ExperienceProps = { ...shared, chat };
  const phone = shared.view === "mobile" || shared.view === "messaging";
  // The MCP panel fills a phone screen edge to edge, so it takes no page gutter.
  const fullBleed = shared.view === "mcp";

  return (
    <div
      key={shared.view}
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col items-center justify-center",
        !phone && !fullBleed && "px-4 md:px-0",
      )}
    >
      {shared.view === "mobile" ? (
        <MobileApp {...props} />
      ) : shared.view === "desktop" ? (
        <DesktopApp {...props} />
      ) : shared.view === "messaging" ? (
        <MessagingAppView {...props} />
      ) : (
        // The panel is a card, not a device: the brand goes on the card itself, so the wrapper paints nothing of its own.
        <div data-brand={brandAttr(shared.brand)} className="contents">
          <McpPanel {...props} />
        </div>
      )}
    </div>
  );
}
