"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowUp, ChevronRight, CreditCard, LogOut, Plus, Square } from "lucide-react";
import {
  AgentCardDetailBody,
  AgentCardTable,
  AnswerPasswordRequest,
  ApproveAgentCard,
  Button,
  CardMark,
  PAYMENT_STEP_ASK,
  SaveCard,
  Skeleton,
  Spinner,
  errorMessage,
  paymentMethodLabel,
  agentCardGroup,
  useAgentCards,
  usePaymentMethods,
  type AgentCardGroup,
  type ApproveOutcome,
  type PasswordRequestOutcome,
  type SaveCardResult,
} from "@agent-commerce/ui";
import { AGENT_COMPANY, AGENT_NAME, AgentAvatar, PLATFORM_NAME } from "@/components/brand";
import { DeviceFrame } from "@/components/frame/device-frame";
import { PhoneSheet } from "@/components/frame/phone-sheet";
import { PhoneStatusBar } from "@/components/frame/phone-status-bar";
import { BuyerDetails } from "@/components/buyer-details";
import { LoginForm } from "@/components/login-form";
import {
  checkoutOf,
  checkoutSiteOf,
  checkoutStatusLine,
  productsMessageOf,
  productsOf,
  receiptMessageOf,
  receiptOf,
  findPaymentStep,
  isCheckoutPart,
  messageText,
  toolBusy,
  toolTitle,
  passwordRequestOf,
  toApprovalOutcome,
  watchIndex,
  watchedHere,
  type WatchIndex,
} from "@/components/chat/parts";
import { APPROVAL_DONE_LINGER_MS, ApprovalInThread } from "@/components/chat/agent-card-approval";
import { PasswordInThread } from "@/components/chat/password-request";
import { AddCardInThread, savedCardOutcome } from "@/components/chat/add-card";
import { WatchRun } from "@/components/chat/checkout-card";
import { CheckoutSiteLine } from "@/components/chat/checkout-site";
import { ProductCards, ProductDetails, pickMessage } from "@/components/chat/product-cards";
import { Receipt } from "@/components/receipt";
import { AgentBubble, ENTER, ENTER_SENT } from "@/components/chat/text";
import { ActivityLine } from "@/components/chat/activity-line";
import { StarterCards } from "@/components/chat/starters";
import { type AgentChat } from "@/components/chat/use-agent-chat";
import { useScrollToBottom } from "@/components/chat/use-scroll-to-bottom";
import type { FoundProduct } from "@/lib/chat/shopify-catalog";
import type { CheckoutOutcome } from "@/lib/chat/tools";
import type { ChatMessage, ChatMessagePart } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { brandAttr, initialOf, loginNext, type ExperienceProps } from "./types";

/**
 * The app as a phone: one chat screen with two round buttons, Cards and
 * Account, that open bottom sheets. An approval waits in the thread as a
 * small card whose Review opens the approval as a sheet over the chat; a
 * checkout runs in the thread itself, its steps and its questions inline. Everything stays inside the phone.
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

/** A store's password request, open in the sheet. */
type PasswordAsk = { toolCallId: string; checkoutId: string; requestId: string; domain: string };

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
  const [password, setPassword] = useState<PasswordAsk | null>(null);
  // The add_card call whose form is open in the sheet.
  const [addCard, setAddCard] = useState<string | null>(null);
  // The product whose details are open, over the chat.
  const [product, setProduct] = useState<FoundProduct | null>(null);

  const onApprovalDone = useCallback(
    (o: ApproveOutcome) => {
      if (!approval) return;
      chat.onApprovalOutcome(approval.toolCallId, toApprovalOutcome(o));
      setTimeout(() => setApproval(null), APPROVAL_DONE_LINGER_MS);
    },
    [approval, chat],
  );
  const onCardSavedHere = useCallback(
    (result: SaveCardResult) => {
      if (!addCard) return;
      chat.onCardSaved(addCard, savedCardOutcome(result));
      setTimeout(() => setAddCard(null), APPROVAL_DONE_LINGER_MS);
    },
    [addCard, chat],
  );
  const onPasswordDone = useCallback(
    (status: PasswordRequestOutcome) => {
      if (!password) return;
      chat.onPasswordOutcome(password.toolCallId, { status });
      setTimeout(() => setPassword(null), APPROVAL_DONE_LINGER_MS);
    },
    [password, chat],
  );

  return (
    <>
      {/* A hairline under the header, so the thread does not run into it. */}
      <div className="flex items-center gap-3 border-b border-border px-5 pt-6 pb-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:pt-2">
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
        onEnterPassword={setPassword}
        onAddCard={setAddCard}
        onOpenProduct={setProduct}
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
        open={product !== null}
        onOpenChange={(open) => !open && setProduct(null)}
        container={screen}
        title={product?.title ?? "Product"}
        hideTitle
      >
        {product ? (
          <ProductDetails
            product={product}
            onBuy={() => {
              chat.send(pickMessage(product));
              setProduct(null);
            }}
          />
        ) : null}
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

      <PhoneSheet
        open={password !== null}
        onOpenChange={(open) => !open && setPassword(null)}
        container={screen}
        title={password ? `Sign in to ${password.domain}` : "Sign in"}
        hideTitle
      >
        {password ? (
          <AnswerPasswordRequest
            key={password.requestId}
            checkoutId={password.checkoutId}
            requestId={password.requestId}
            merchantDomain={password.domain}
            platformName={AGENT_COMPANY}
            onDone={onPasswordDone}
          />
        ) : null}
      </PhoneSheet>

      <PhoneSheet
        open={addCard !== null}
        onOpenChange={(open) => !open && setAddCard(null)}
        container={screen}
        title="Add a card"
      >
        {addCard ? <SaveCard key={addCard} showResult={false} onSaved={onCardSavedHere} /> : null}
      </PhoneSheet>
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
  onEnterPassword,
  onAddCard,
  onOpenProduct,
}: {
  chat: AgentChat;
  loading: boolean;
  chatEnabled: boolean;
  onReview: (approval: Approval) => void;
  onEnterPassword: (ask: PasswordAsk) => void;
  onAddCard: (toolCallId: string) => void;
  onOpenProduct: (product: FoundProduct) => void;
}) {
  const { containerRef } = useScrollToBottom(chat.messages.length);
  const last = chat.messages.at(-1);
  const waiting = chat.status === "submitted" && last?.role !== "assistant";
  const watches = useMemo(() => watchIndex(chat.messages), [chat.messages]);

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
      // Scrolls inside the space it has, so on a short screen (an iPhone SE)
      // the composer below stays on screen. Pinned to the bottom when it fits.
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 scrollbar-none">
        <div className="mt-auto flex flex-col gap-5 pt-4">
          <div className="flex flex-col gap-3">
            <AgentAvatar size={40} />
            <p className="text-[24px] leading-[1.2] font-medium tracking-[-0.02em] text-balance">
              Hi, I am {AGENT_NAME}. What can I get you?
            </p>
          </div>
          <StarterCards onPick={chat.send} />
        </div>
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
              onEnterPassword={onEnterPassword}
              onAddCard={onAddCard}
              onCheckoutOutcome={chat.onCheckoutOutcome}
              watches={watches}
              onSend={chat.send}
              onOpenProduct={onOpenProduct}
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
  onEnterPassword,
  onAddCard,
  onCheckoutOutcome,
  watches,
  onSend,
  onOpenProduct,
}: {
  message: ChatMessage;
  streaming: boolean;
  onReview: (a: Approval) => void;
  onEnterPassword: (ask: PasswordAsk) => void;
  onAddCard: (toolCallId: string) => void;
  onCheckoutOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  watches: WatchIndex;
  onSend: (text: string) => void;
  onOpenProduct: (product: FoundProduct) => void;
}) {
  if (message.role === "user") {
    const text = messageText(message);
    return text ? (
      <div
        className={cn(
          "ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-snug break-words whitespace-pre-wrap text-primary-foreground",
          ENTER_SENT,
        )}
      >
        {text}
      </div>
    ) : null;
  }
  if (message.role !== "assistant") return null;
  const parts = message.parts.map((part, i) => (
    // Each part rises in as it arrives. A part that draws nothing leaves no gap.
    <div key={`${message.id}-${i}`} className={cn("flex flex-col gap-2 empty:hidden", ENTER)}>
      <CompactPart
        part={part}
        message={message}
        onReview={onReview}
        onEnterPassword={onEnterPassword}
        onAddCard={onAddCard}
        onCheckoutOutcome={onCheckoutOutcome}
        watches={watches}
        onSend={onSend}
        onOpenProduct={onOpenProduct}
      />
    </div>
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
  onEnterPassword,
  onAddCard,
  onCheckoutOutcome,
  watches,
  onSend,
  onOpenProduct,
}: {
  part: ChatMessagePart;
  message: ChatMessage;
  onReview: (a: Approval) => void;
  onEnterPassword: (ask: PasswordAsk) => void;
  onAddCard: (toolCallId: string) => void;
  onCheckoutOutcome: (toolCallId: string, outcome: CheckoutOutcome) => void;
  watches: WatchIndex;
  onSend: (text: string) => void;
  onOpenProduct: (product: FoundProduct) => void;
}) {
  switch (part.type) {
    case "text":
      return part.text.trim() ? (
        <AgentBubble
          text={part.text}
          className="max-w-[85%] px-3.5 py-2 text-[15px] leading-snug"
        />
      ) : null;

    case "tool-await_agent_card_approval": {
      const requestId = part.input?.requestId ?? "";
      // A checkout waiting on this is the user choosing how to pay for
      // something already underway, not an agent asking for a budget.
      const paying =
        watches.paymentRequests.has(requestId) || Boolean(findPaymentStep(message, requestId));
      if (part.state === "input-available" || part.state === "output-available") {
        return (
          <ApprovalInThread
            requestId={part.input.requestId}
            output={part.state === "output-available" ? part.output : undefined}
            paying={paying}
            onReview={() =>
              onReview({ toolCallId: part.toolCallId, requestId: part.input.requestId, paying })
            }
            bubbleClassName="max-w-[85%] px-3.5 py-2 text-[15px] leading-snug"
            className="max-w-none"
          />
        );
      }
      return (
        <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
          {toolTitle(part.type)}
        </ActivityLine>
      );
    }

    // Adding a card: Crossmint's card form in a sheet.
    case "tool-await_saved_card":
      if (part.state === "input-available" || part.state === "output-available") {
        return (
          <AddCardInThread
            output={part.state === "output-available" ? part.output : undefined}
            onAdd={() => onAddCard(part.toolCallId)}
            bubbleClassName="max-w-[85%] px-3.5 py-2 text-[15px] leading-snug"
            className="max-w-none"
          />
        );
      }
      return (
        <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
          {toolTitle(part.type)}
        </ActivityLine>
      );

    // The store asks for a password: Crossmint's field in a sheet, never words.
    case "tool-await_protected_input": {
      const request = passwordRequestOf(part, watches);
      if (request && (part.state === "input-available" || part.state === "output-available")) {
        return (
          <PasswordInThread
            domain={request.domain}
            output={part.state === "output-available" ? part.output : undefined}
            onEnter={() => onEnterPassword({ toolCallId: part.toolCallId, ...request })}
            bubbleClassName="max-w-[85%] px-3.5 py-2 text-[15px] leading-snug"
            className="max-w-none"
          />
        );
      }
      return (
        <ActivityLine busy={toolBusy(part.state)} failed={part.state === "output-error"}>
          {toolTitle(part.type)}
        </ActivityLine>
      );
    }

    // The store's agent speaks through the watch: each update is a line of
    // the agent's own, live while the run goes, from the output after.
    case "tool-watch_checkout":
      // Each call is one stretch of the checkout, as a card of steps.
      if (part.state === "input-available" || part.state === "output-available") {
        return (
          <WatchRun
            toolCallId={part.toolCallId}
            checkoutId={part.input.checkoutId}
            watches={watches}
            output={part.state === "output-available" ? part.output : undefined}
            onOutcome={onCheckoutOutcome}
            compact
            className="max-w-none"
          />
        );
      }
      return part.state === "output-error" ? (
        <ActivityLine failed>{toolTitle(part.type)}</ActivityLine>
      ) : null;

    default: {
      if (isCheckoutPart(part)) {
        // Starting a checkout says, once, which site the agent went to.
        const site = checkoutSiteOf(part);
        const failed =
          part.state === "output-error" ||
          (part.state === "output-available" &&
            Boolean((part.output as { error?: unknown } | undefined)?.error));
        if (site && !failed) {
          // The steps card names the site once the run is followed; until then, a line.
          if (site.checkoutId && watches.firstWatch.has(site.checkoutId)) return null;
          return <CheckoutSiteLine site={site} className="-mb-1 pl-1" />;
        }
        if (watchedHere(message, part)) return null;
        const view = checkoutOf(part);
        return (
          <ActivityLine
            busy={toolBusy(part.state)}
            failed={part.state === "output-error" || Boolean(view?.failure)}
          >
            {view ? checkoutStatusLine(view) : toolTitle(part.type)}
          </ActivityLine>
        );
      }
      {
        // What a search or a look-up found, as cards with pictures, under the
        // line the agent put on the call.
        const message = productsMessageOf(part);
        const products = productsOf(part);
        if (message || products?.length) {
          return (
            <>
              {message ? (
                <AgentBubble
                  text={message}
                  className="max-w-[85%] px-3.5 py-2 text-[15px] leading-snug"
                />
              ) : null}
              {products?.length ? (
                <ProductCards products={products} onPick={onSend} onOpen={onOpenProduct} compact />
              ) : null}
            </>
          );
        }
      }
      {
        // A checkout that went through: the receipt, under the agent's line on it.
        const message = receiptMessageOf(part);
        const receipt = receiptOf(part);
        if (message || receipt) {
          return (
            <>
              {message ? (
                <AgentBubble
                  text={message}
                  className="max-w-[85%] px-3.5 py-2 text-[15px] leading-snug"
                />
              ) : null}
              {receipt ? <Receipt receipt={receipt} className="max-w-[85%]" /> : null}
            </>
          );
        }
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

/** The most lines the message box grows to before it scrolls. */
const COMPOSER_MAX_LINES = 3;

function Composer({ chat, disabled }: { chat: AgentChat; disabled: boolean }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !chat.busy && !disabled && text.trim().length > 0;

  // The box grows with its text, a line at a time, up to three lines; past that it scrolls.
  useLayoutEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    const style = getComputedStyle(box);
    const line = parseFloat(style.lineHeight) || 24;
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, line * COMPOSER_MAX_LINES + padding)}px`;
  }, [text]);

  function submit() {
    if (!canSend) return;
    chat.send(text.trim());
    setText("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
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
      {/* 24px corners: a pill at one line, a rounded box as it grows. */}
      <div className="flex min-h-12 items-end gap-2 rounded-3xl bg-muted py-1.5 pr-1.5 pl-4">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder="Ask the agent to buy something"
          aria-label="Message"
          className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base leading-6 text-foreground outline-none scrollbar-none placeholder:text-muted-foreground disabled:opacity-50"
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
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Buyer details</p>
        <p className="text-xs text-muted-foreground">
          Every checkout starts with these, so stores do not ask. You can also tell the agent.
        </p>
        <BuyerDetails email={email} />
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
