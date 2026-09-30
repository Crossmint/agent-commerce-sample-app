"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown, CreditCard, LogOut, Plus, Trash2, TriangleAlert, UserRound, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Spinner } from "@agent-commerce/ui";
import { AGENT_DOMAIN, AGENT_NAME, AgentMark } from "@/components/brand";
import { BuyerDetails } from "@/components/buyer-details";
import { ScreenHeading } from "@/components/focus-screen";
import { Messages } from "@/components/chat/messages";
import { MultimodalInput } from "@/components/chat/multimodal-input";
import { DesktopFrame } from "@/components/frame/desktop-frame";
import { LoginForm } from "@/components/login-form";
import type { ChatSummary } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { CardsSection } from "./cards-section";
import { brandAttr, initialOf, loginNext, type ExperienceProps } from "./types";

type Section = "chat" | "cards" | "details";

/**
 * The app in a browser window: a sidebar with the conversations and the
 * person, and the chat or the Cards section beside it. Signed out, the login
 * stands alone in the middle of the window.
 */
export function DesktopApp(props: ExperienceProps) {
  return (
    <DesktopFrame address={`${AGENT_DOMAIN}/app`} className="flex-1 md:flex-none">
      {/* The brand wraps the window's content, not the window: the title bar stays, the app re-themes. */}
      <div data-brand={brandAttr(props.brand)} className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
        {props.signedIn ? (
          <Workspace {...props} />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-10">
            <LoginForm next={loginNext(props)} onSignedIn={props.onSignedIn} className="w-full max-w-sm" />
          </div>
        )}
      </div>
    </DesktopFrame>
  );
}

function Workspace({ email, chat, thread, chats, chatEnabled, attachmentsEnabled, onOpenChat, onNewChat, onDeleteChat, onSignOut }: ExperienceProps) {
  const [section, setSection] = useState<Section>("chat");

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
          <AgentMark size={28} />
          <span className="truncate text-sm font-semibold text-foreground">{AGENT_NAME}</span>
        </div>
        <div className="flex flex-col gap-1 p-3">
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start"
            onClick={() => {
              setSection("chat");
              onNewChat();
            }}
          >
            <Plus /> New chat
          </Button>
          <NavItem active={section === "cards"} onClick={() => setSection("cards")}>
            <CreditCard className="size-4" /> Saved cards
          </NavItem>
          <NavItem active={section === "details"} onClick={() => setSection("details")}>
            <UserRound className="size-4" /> Buyer details
          </NavItem>
        </div>

        <nav aria-label="Chats" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
          {chats ? (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">Chats</p>
              {chats.length === 0 ? (
                <p className="px-3 py-1.5 text-xs text-muted-foreground">Your chats show up here.</p>
              ) : (
                chats.map((c) => (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    active={section === "chat" && c.id === thread.id}
                    onOpen={() => {
                      setSection("chat");
                      onOpenChat(c.id);
                    }}
                    onDelete={() => onDeleteChat(c.id)}
                  />
                ))
              )}
            </>
          ) : chatEnabled ? (
            <p className="px-3 pt-2 text-xs text-muted-foreground">Set DATABASE_URL to keep chat history.</p>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <ProfileMenu email={email} onSignOut={onSignOut} />
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        {section === "cards" ? (
          <div key="cards" className="flex flex-1 flex-col animate-in fade-in duration-200">
            <CardsSection />
          </div>
        ) : section === "details" ? (
          <div key="details" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-in fade-in duration-200 sm:px-8">
            <ScreenHeading title="Buyer details" sub="Your name, email and shipping address. Every checkout starts with them, so stores do not ask. You can also tell the agent in the chat." />
            <BuyerDetails email={email} />
          </div>
        ) : thread.loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <LateSpinner />
          </div>
        ) : !chatEnabled ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <Alert className="max-w-md">
              <TriangleAlert />
              <AlertTitle>Chat is off</AlertTitle>
              <AlertDescription>Set ANTHROPIC_API_KEY or OPENAI_API_KEY to turn it on. Saved cards still work.</AlertDescription>
            </Alert>
          </div>
        ) : (
          <div key={thread.id} className="flex min-h-0 flex-1 flex-col animate-in fade-in duration-200">
            <Messages messages={chat.messages} status={chat.status} onApprovalOutcome={chat.onApprovalOutcome} onPasswordOutcome={chat.onPasswordOutcome} onCardSaved={chat.onCardSaved} onBuyerDetails={chat.onBuyerDetails} onPaymentChoice={chat.onPaymentChoice} onBudget={chat.onBudget} onCheckoutOutcome={chat.onCheckoutOutcome} email={email} onPickStarter={(text) => chat.send(text)} onSend={(text) => chat.send(text)} />
            <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4 sm:px-6">
              {chat.error ? (
                <Alert variant="destructive" className="mb-3">
                  <TriangleAlert />
                  <AlertTitle>That did not work</AlertTitle>
                  <AlertDescription className="w-full">
                    <div className="flex w-full items-start justify-between gap-3">
                      <p>{chat.error}</p>
                      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 rounded-full" aria-label="Dismiss" onClick={chat.dismissError}>
                        <X />
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
              <MultimodalInput status={chat.status} attachmentsEnabled={attachmentsEnabled} onSend={chat.send} onStop={chat.stop} onError={chat.reportError} />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">The agent asks before it spends. Your card number never reaches the agent or the store.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** How long a chat's history may take before a spinner says it is on its way. */
const SPINNER_DELAY_MS = 400;

/**
 * A spinner that shows only once the wait is long enough to notice. A saved
 * chat usually loads at once, and a spinner that flashes just before the
 * thread fades in makes one change look like two.
 */
function LateSpinner() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), SPINNER_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  return shown ? <Spinner className="animate-in fade-in duration-200" /> : null;
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ChatRow({ chat, active, onOpen, onDelete }: { chat: ChatSummary; active: boolean; onOpen: () => void; onDelete: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  return (
    <div className={cn("group flex items-center rounded-full text-sm transition-colors hover:bg-muted/60", active && "bg-muted text-foreground")}>
      <button type="button" onClick={onOpen} aria-current={active ? "page" : undefined} className={cn("min-w-0 flex-1 truncate px-3 py-1.5 text-left", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
        {chat.title}
      </button>
      <button
        type="button"
        aria-label={`Delete ${chat.title}`}
        disabled={pending}
        onClick={async () => {
          if (!window.confirm(`Delete "${chat.title}"?`)) return;
          setPending(true);
          try {
            await onDelete();
          } finally {
            setPending(false);
          }
        }}
        className="mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
      >
        {pending ? <Spinner className="size-3" /> : <Trash2 className="size-3" />}
      </button>
    </div>
  );
}

/** The person, at the foot of the sidebar. The whole row is the trigger. */
function ProfileMenu({ email, onSignOut }: { email?: string; onSignOut: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-full px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">{initialOf(email)}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{email ?? "Signed in"}</span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        {email ? <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel> : null}
        {email ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          variant="destructive"
          disabled={busy}
          // Radix closes the menu on select; keep it open while the call runs.
          onSelect={(e) => {
            e.preventDefault();
            setBusy(true);
            void onSignOut().finally(() => setBusy(false));
          }}
        >
          {busy ? <Spinner /> : <LogOut aria-hidden />}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
