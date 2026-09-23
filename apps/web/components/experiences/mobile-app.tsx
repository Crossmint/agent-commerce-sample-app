"use client";

import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CreditCard,
  LogOut,
  Plus,
  Square,
} from "lucide-react";
import {
  AgentCardDetailBody,
  AgentCardTable,
  ApproveAgentCard,
  PAYMENT_STEP_ASK,
  Badge,
  Button,
  CardMark,
  CheckoutView as CheckoutViewPanel,
  SaveCard,
  Skeleton,
  Spinner,
  errorMessage,
  formatAmount,
  paymentMethodLabel,
  agentCardGroup,
  useAgentCards,
  usePaymentMethods,
  type AgentCardGroup,
  type ApproveOutcome,
} from "@agent-commerce/ui";
import type { CheckoutView } from "@agent-commerce/server";
import { AGENT_NAME, AgentAvatar, PLATFORM_NAME } from "@/components/brand";
import { DeviceFrame } from "@/components/frame/device-frame";
import {
  PAGE_SHEET_TRANSITION_MS,
  PhonePageSheet,
  PhoneSheet,
} from "@/components/frame/phone-sheet";
import { PhoneStatusBar } from "@/components/frame/phone-status-bar";
import { LoginForm } from "@/components/login-form";
import {
  approvalLabel,
  checkoutOf,
  checkoutStatusLine,
  checkoutBadgeVariant,
  findPaymentStep,
  findRequest,
  isCheckoutPart,
  messageText,
  toApprovalOutcome,
  toolBusy,
  toolTitle,
} from "@/components/chat/parts";
import { Text } from "@/components/chat/text";
import { SUGGESTIONS, type AgentChat } from "@/components/chat/use-agent-chat";
import { useScrollToBottom } from "@/components/chat/use-scroll-to-bottom";
import type { ApprovalOutcome } from "@/lib/chat/tools";
import type { ChatMessage, ChatMessagePart } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { brandAttr, initialOf, loginNext, type ExperienceProps } from "./types";

/** How long an ending stays on screen before its sheet slides away. */
const DONE_LINGER_MS = 800;

/**
 * The app as a phone: one chat screen with two round buttons, Cards and
 * Account, that open bottom sheets. An approval opens as a sheet over the
 * chat; a checkout opens as a full page that slides up. Everything stays
 * inside the phone.
 */
export function MobileApp(props: ExperienceProps) {
  // The sheets portal into the screen so they stay inside the frame.
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  return (
    <DeviceFrame className="flex-1 md:flex-none" reserveTop={props.reserveTop}>
      {/* The brand wraps the screen, not the phone: the chrome stays, the app re-themes. */}
      <div
        ref={setScreen}
        data-brand={brandAttr(props.brand)}
        className="relative flex h-full min-h-0 flex-1 flex-col bg-background text-foreground"
      >
        <PhoneStatusBar />
        {props.signedIn ? (
          <Home {...props} screen={screen} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-10 pb-8 scrollbar-none">
            <LoginForm next={loginNext(props)} onSignedIn={props.onSignedIn} />
          </div>
        )}
      </div>
    </DeviceFrame>
  );
}

// ---------------------------------------------------------------------------
// Signed in
// ---------------------------------------------------------------------------

type Approval = {
  toolCallId: string;
  requestId: string;
  /** Set when a checkout's payment step raised this, so the sheet says so. */
  paying?: boolean;
};

function Home({
  screen,
  email,
  chat,
  thread,
  chatEnabled,
  onSignOut,
}: ExperienceProps & { screen: HTMLDivElement | null }) {
  const [cardsOpen, setCardsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [approval, setApproval] = useState<Approval | null>(null);
  // The checkout page keeps its id through the slide-out, so it does not go blank while leaving.
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const openCheckout = useCallback((id: string) => {
    setCheckoutId(id);
    setCheckoutOpen(true);
  }, []);
  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
    setTimeout(() => setCheckoutId(null), PAGE_SHEET_TRANSITION_MS);
  }, []);

  const onApprovalDone = useCallback(
    (o: ApproveOutcome) => {
      if (!approval) return;
      chat.onApprovalOutcome(approval.toolCallId, toApprovalOutcome(o));
      setTimeout(() => setApproval(null), DONE_LINGER_MS);
    },
    [approval, chat],
  );

  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-6 md:pt-2">
        <h1 className="flex-1 text-[28px] leading-[1.2] font-medium tracking-[-0.02em]">Chat</h1>
        <RoundButton label="Cards" onClick={() => setCardsOpen(true)}>
          <CreditCard className="size-4.5" />
        </RoundButton>
        <RoundButton label="Account" onClick={() => setAccountOpen(true)}>
          <span className="text-sm font-semibold text-primary">{initialOf(email)}</span>
        </RoundButton>
      </div>

      <Thread
        chat={chat}
        loading={thread.loading}
        chatEnabled={chatEnabled}
        onReview={setApproval}
        onOpenCheckout={openCheckout}
      />
      <Composer chat={chat} disabled={!chatEnabled} />

      <PhoneSheet open={cardsOpen} onOpenChange={setCardsOpen} container={screen} title="Cards">
        {cardsOpen ? <CardsSheetBody /> : null}
      </PhoneSheet>

      <PhoneSheet
        open={accountOpen}
        onOpenChange={setAccountOpen}
        container={screen}
        title="Account"
        height="h-[80%]"
      >
        <AccountSheetBody email={email} onSignOut={onSignOut} />
      </PhoneSheet>

      <PhoneSheet
        open={approval !== null}
        onOpenChange={(open) => !open && setApproval(null)}
        container={screen}
        title="Approve"
        hideTitle
      >
        {approval ? (
          <ApproveAgentCard
            requestId={approval.requestId}
            variant="plain"
            platformName={PLATFORM_NAME}
            ask={approval.paying ? PAYMENT_STEP_ASK : undefined}
            onDone={onApprovalDone}
          />
        ) : null}
      </PhoneSheet>

      <PhonePageSheet open={checkoutOpen} ariaLabel="Checkout">
        <div className="flex items-center gap-3 px-5 pt-6 pb-2 md:pt-14">
          <RoundButton label="Back" onClick={closeCheckout}>
            <ArrowLeft className="size-4.5" />
          </RoundButton>
          <h2 className="text-lg font-medium tracking-[-0.02em]">Checkout</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 scrollbar-none">
          {checkoutId ? (
            <CheckoutViewPanel
              checkoutId={checkoutId}
              frameHeight={420}
              platformName={PLATFORM_NAME}
            />
          ) : null}
        </div>
      </PhonePageSheet>
    </>
  );
}

function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted-strong"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

function Thread({
  chat,
  loading,
  chatEnabled,
  onReview,
  onOpenCheckout,
}: {
  chat: AgentChat;
  loading: boolean;
  chatEnabled: boolean;
  onReview: (approval: Approval) => void;
  onOpenCheckout: (checkoutId: string) => void;
}) {
  const { containerRef } = useScrollToBottom();
  const last = chat.messages.at(-1);
  const waiting = chat.status === "submitted" && last?.role !== "assistant";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  if (!chatEnabled) {
    return (
      <div className="flex flex-1 flex-col justify-center px-5">
        <Notice>Chat is off. Set ANTHROPIC_API_KEY or OPENAI_API_KEY to turn it on.</Notice>
      </div>
    );
  }

  if (chat.messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-end gap-6 px-5 pb-4">
        <div className="flex flex-col gap-3">
          <AgentAvatar size={40} />
          <p className="text-[24px] leading-[1.2] font-medium tracking-[-0.02em] text-balance">
            Hi, I am {AGENT_NAME}. What should I buy for you?
          </p>
          <p className="text-sm text-muted-foreground">
            Send me a link and I will go buy it. You choose how to pay at the checkout.
          </p>
        </div>
        <ul className="flex flex-col gap-2" aria-label="Suggestions">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => chat.send(s)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-left text-sm transition-colors hover:bg-muted-strong"
              >
                <span className="min-w-0 truncate">{s}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto scrollbar-none">
        <div className="flex flex-col gap-3 px-5 py-4">
          {chat.messages.map((m, i) => (
            <CompactMessage
              key={m.id}
              message={m}
              streaming={chat.status === "streaming" && i === chat.messages.length - 1}
              onReview={onReview}
              onOpenCheckout={onOpenCheckout}
            />
          ))}
          {waiting ? <ActivityLine busy>Thinking</ActivityLine> : null}
          {chat.error ? (
            <Notice tone="error" onDismiss={chat.dismissError}>
              {chat.error}
            </Notice>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompactMessage({
  message,
  streaming,
  onReview,
  onOpenCheckout,
}: {
  message: ChatMessage;
  streaming: boolean;
  onReview: (a: Approval) => void;
  onOpenCheckout: (id: string) => void;
}) {
  if (message.role === "user") {
    const text = messageText(message);
    return text ? (
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap text-primary-foreground">
        {text}
      </div>
    ) : null;
  }
  if (message.role !== "assistant") return null;
  const parts = message.parts.map((part, i) => (
    <CompactPart
      key={`${message.id}-${i}`}
      part={part}
      message={message}
      onReview={onReview}
      onOpenCheckout={onOpenCheckout}
    />
  ));
  const empty = parts.every((p) => p === null) && streaming;
  return (
    <div className="flex flex-col gap-2">
      {empty ? <ActivityLine busy>Thinking</ActivityLine> : null}
      {parts}
    </div>
  );
}

function CompactPart({
  part,
  message,
  onReview,
  onOpenCheckout,
}: {
  part: ChatMessagePart;
  message: ChatMessage;
  onReview: (a: Approval) => void;
  onOpenCheckout: (id: string) => void;
}) {
  switch (part.type) {
    case "text":
      return part.text.trim() ? (
        <Text text={part.text} className="max-w-[92%] text-[15px] leading-snug" />
      ) : null;

    case "tool-await_agent_card_approval": {
      const requestId = part.input?.requestId ?? "";
      const request = findRequest(message, requestId);
      // A checkout waiting on this is the user choosing how to pay for
      // something already underway, not an agent asking for a budget.
      const paying = Boolean(findPaymentStep(message, requestId));
      if (part.state === "input-available") {
        return (
          <ApprovalCard
            title={
              paying
                ? "Choose how to pay for this"
                : request
                  ? `Your agent wants to spend up to ${formatAmount(request.amount.value, request.amount.currency)} for ${request.description}`
                  : "Your agent is asking for a budget"
            }
            action={
              <Button
                type="button"
                size="xl"
                className="w-full"
                onClick={() =>
                  onReview({ toolCallId: part.toolCallId, requestId: part.input.requestId, paying })
                }
              >
                Review
              </Button>
            }
          />
        );
      }
      if (part.state === "output-available") {
        return (
          <ApprovalCard
            title={
              request
                ? `${formatAmount(request.amount.value, request.amount.currency)} for ${request.description}`
                : "Budget request"
            }
            outcome={part.output}
          />
        );
      }
      return (
        <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
          {toolTitle(part.type)}
        </ActivityLine>
      );
    }

    default: {
      if (isCheckoutPart(part)) {
        const view = checkoutOf(part);
        if (view) return <CheckoutCardCompact view={view} onOpen={() => onOpenCheckout(view.id)} />;
        return (
          <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
            {toolTitle(part.type)}
          </ActivityLine>
        );
      }
      if (part.type.startsWith("tool-")) {
        const tool = part as { type: string; state: string; output?: unknown };
        const failed =
          tool.state === "output-error" ||
          (tool.state === "output-available" &&
            Boolean((tool.output as { error?: unknown } | undefined)?.error));
        return (
          <ActivityLine busy={toolBusy(tool.state)} failed={failed}>
            {toolTitle(tool.type)}
          </ActivityLine>
        );
      }
      return null;
    }
  }
}

/** "Looking at your saved cards", with a spinner while it runs and a check when it is done. */
function ActivityLine({
  busy,
  failed,
  children,
}: {
  busy?: boolean;
  failed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        failed && "text-destructive",
      )}
    >
      {busy ? (
        <Spinner className="size-3" />
      ) : failed ? (
        <CircleAlert className="size-3.5" />
      ) : (
        <CircleCheck className="size-3.5 text-success" />
      )}
      <span className="truncate">{children}</span>
    </div>
  );
}

function ApprovalCard({
  title,
  action,
  outcome,
}: {
  title: string;
  action?: ReactNode;
  outcome?: ApprovalOutcome;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-snug font-medium text-balance">{title}</p>
        {outcome ? (
          <Badge
            variant={
              outcome.status === "active"
                ? "success"
                : outcome.status === "denied"
                  ? "destructive"
                  : "muted"
            }
          >
            {outcome.status}
          </Badge>
        ) : null}
      </div>
      {outcome ? <p className="text-xs text-muted-foreground">{approvalLabel(outcome)}</p> : null}
      {action}
    </div>
  );
}

function CheckoutCardCompact({ view, onOpen }: { view: CheckoutView; onOpen: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-medium">Checkout</p>
          <p className="truncate text-xs text-muted-foreground">{checkoutStatusLine(view)}</p>
        </div>
        <Badge variant={checkoutBadgeVariant(view.status)}>{view.status.replace(/_/g, " ")}</Badge>
      </div>
      <Button type="button" size="xl" variant="secondary" className="w-full" onClick={onOpen}>
        Open checkout
      </Button>
    </div>
  );
}

function Notice({
  tone = "muted",
  onDismiss,
  children,
}: {
  tone?: "muted" | "error";
  onDismiss?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3 text-sm",
        tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      <p className="min-w-0 flex-1">{children}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium underline-offset-4 hover:underline"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The composer
// ---------------------------------------------------------------------------

function Composer({ chat, disabled }: { chat: AgentChat; disabled: boolean }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = !chat.busy && !disabled && text.trim().length > 0;

  function submit() {
    if (!canSend) return;
    chat.send(text.trim());
    setText("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      className="shrink-0 px-4 pt-2 pb-6"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex h-12 items-center gap-2 rounded-full bg-muted pr-1.5 pl-4">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Ask the agent to buy something"
          aria-label="Message"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        {chat.busy ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={chat.stop}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            disabled={!canSend}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="size-4.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// The Cards sheet: two panels, the list and the card form.
// ---------------------------------------------------------------------------

/** The piles the desktop Cards section uses, in the same order. */
const PILES: Array<{ group: AgentCardGroup; title: string }> = [
  { group: "active", title: "Active" },
  { group: "needs-verification", title: "Needs verification" },
  { group: "needs-cvc", title: "Needs security code" },
  { group: "expired", title: "Expired" },
];

function CardsSheetBody() {
  const [panel, setPanel] = useState<"list" | "form" | "detail">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const paymentMethods = usePaymentMethods();
  const agentCards = useAgentCards();

  if (panel === "form") {
    return (
      <Panel title="Add card" onBack={() => setPanel("list")}>
        <SaveCard
          showResult={false}
          onSaved={async () => {
            await paymentMethods.refetch();
            setPanel("list");
          }}
        />
      </Panel>
    );
  }

  if (panel === "detail") {
    const card = agentCards.data?.find((c) => c.orderIntentId === openId);
    const pm = paymentMethods.data?.find((p) => p.paymentMethodId === card?.paymentMethodId);
    return (
      <Panel title={card?.description ?? "Agent card"} onBack={() => setPanel("list")}>
        {card ? (
          <AgentCardDetailBody
            agentCard={card}
            paymentMethod={pm}
            busy={revoking}
            onRevoke={
              card.status === "active"
                ? async () => {
                    setRevoking(true);
                    try {
                      await agentCards.revoke(card.orderIntentId);
                      setPanel("list");
                    } finally {
                      setRevoking(false);
                    }
                  }
                : undefined
            }
          />
        ) : null}
      </Panel>
    );
  }

  const all = agentCards.data;
  const piles = PILES.map((pile) => ({
    ...pile,
    cards: all?.filter((c) => agentCardGroup(c) === pile.group),
  }));
  // Nothing to count while the list is on its way, so the first pile carries
  // the skeleton and the others stay out of the way.
  const shown = all ? piles.filter((p) => p.cards!.length > 0) : piles.slice(0, 1);

  return (
    <div className="flex flex-col gap-8 pt-2 animate-in fade-in duration-200">
      <section className="flex flex-col gap-1">
        <p className="pb-1 text-sm text-muted-foreground">Saved cards</p>
        <SavedCardRows cards={paymentMethods} />
        <button
          type="button"
          onClick={() => setPanel("form")}
          className="flex w-full items-center gap-3 py-3.5 text-left"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Plus className="size-4.5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">Add new card</span>
            <span className="block text-xs text-muted-foreground">Debit or credit card</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </section>

      {/* One table per pile, as the desktop Cards section has. */}
      {all && shown.length === 0 ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Agent cards</p>
          <AgentCardTable compact agentCards={[]} paymentMethods={paymentMethods.data} />
        </section>
      ) : (
        shown.map((pile, i) => (
          <section key={pile.group} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {i === 0 ? `Agent cards · ${pile.title}` : pile.title}
            </p>
            <AgentCardTable
              compact
              agentCards={pile.cards}
              paymentMethods={paymentMethods.data}
              loading={agentCards.loading}
              onRevoke={(id) => agentCards.revoke(id)}
              onVerified={async () => {
                await agentCards.refetch();
              }}
              // One saved card can back several budgets, so the whole list is
              // read again rather than this one row.
              onCvcRecollected={async () => {
                await agentCards.refetch();
              }}
              onSelect={(card) => {
                setOpenId(card.orderIntentId);
                setPanel("detail");
              }}
            />
          </section>
        ))
      )}
    </div>
  );
}

/** A panel of the Cards sheet behind a back button, in the sheet's own frame. */
function Panel({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3">
        <RoundButton label="Back" onClick={onBack}>
          <ArrowLeft className="size-4.5" />
        </RoundButton>
        <p className="min-w-0 flex-1 truncate text-base font-medium">{title}</p>
      </div>
      {children}
    </div>
  );
}

function SavedCardRows({ cards }: { cards: ReturnType<typeof usePaymentMethods> }) {
  const { data, loading, error, remove } = cards;
  const [busy, setBusy] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  }
  if (error && !data) return <p className="py-2 text-sm text-destructive">{errorMessage(error)}</p>;
  if (!data?.length)
    return <p className="py-2 text-sm text-muted-foreground">No cards yet. Add one below.</p>;

  return (
    <ul className="flex flex-col">
      {data.map((pm) => (
        <li
          key={pm.paymentMethodId}
          className="flex items-center gap-3 border-b border-border/60 py-3.5"
        >
          <span className="flex w-9 shrink-0 justify-center">
            <CardMark paymentMethod={pm} size="md" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{paymentMethodLabel(pm)}</span>
            {pm.card?.expiration ? (
              <span className="block text-xs text-muted-foreground">
                Expires {pm.card.expiration.month}/{pm.card.expiration.year}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            disabled={busy === pm.paymentMethodId}
            onClick={async () => {
              if (!window.confirm(`Remove ${paymentMethodLabel(pm)}?`)) return;
              setBusy(pm.paymentMethodId);
              try {
                await remove(pm.paymentMethodId);
              } finally {
                setBusy(null);
              }
            }}
            className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {busy === pm.paymentMethodId ? <Spinner className="size-3.5" /> : "Remove"}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// The Account sheet
// ---------------------------------------------------------------------------

function AccountSheetBody({ email, onSignOut }: Pick<ExperienceProps, "email" | "onSignOut">) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-full flex-col gap-8 pt-2">
      <div className="flex flex-col items-center gap-3 pt-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-primary">
          {initialOf(email)}
        </span>
        <p className="text-sm font-medium">{email ?? "Signed in"}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="xl"
        className="mt-auto w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSignOut();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <LogOut />}
        Log out
      </Button>
    </div>
  );
}
