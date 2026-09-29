"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AnswerPasswordRequest,
  ApproveAgentCard,
  SaveCard,
  errorMessage,
  useAgentCards,
  useAgentCommerce,
  formatAmount,
  PAYMENT_STEP_ASK,
  type CheckoutStep,
  type ApproveOutcome,
  type PasswordRequestOutcome,
  type SaveCardResult,
} from "@agent-commerce/ui";
import {
  AGENT_COMPANY,
  AGENT_DOMAIN,
  AGENT_NAME,
  AgentAvatar,
  AgentMark,
  PLATFORM_NAME,
} from "@/components/brand";
import {
  checkoutSiteOf,
  findPaymentStep,
  findRequest,
  passwordRequestOf,
  pendingCall,
  pendingWatches,
  productFor,
  productsMessageOf,
  productsOf,
  receiptMessageOf,
  receiptOf,
  runSteps,
  stoppedForUser,
  toApprovalOutcome,
  watchIndex,
  type CheckoutSite,
  type WatchIndex,
} from "@/components/chat/parts";
import { CheckoutRunCard, SiteIcon, siteLine } from "@/components/chat/checkout-site";
import { ENTER, ENTER_SENT } from "@/components/chat/text";
import { pickMessage, ProductDetails, ProductImage } from "@/components/chat/product-cards";
import { CheckoutWatcher, runTitle, type LiveWatch } from "@/components/chat/checkout-card";
import { STARTERS } from "@/components/chat/starters";
import { savedCardOutcome } from "@/components/chat/add-card";
import {
  BUYER_DETAILS_NOTE,
  BUYER_DETAILS_QUESTION,
  BuyerDetailsSheetBody,
} from "@/components/chat/buyer-details-request";
import {
  CARD_STEP_QUESTION,
  OTHER_STEP_QUESTION,
  SOMETHING_ELSE,
  approvedCardOutcome,
  cardOptions,
  choiceSubject,
  fittingCards,
  optionKey,
  otherOptions,
  paymentChoiceLabel,
  paymentChoiceOutcome,
  paymentChoiceQuestion,
  newCardRequest,
  paymentOptions,
  type PaymentOption,
} from "@/components/chat/payment-choice";
import { Receipt, type ReceiptData } from "@/components/receipt";
import { useScrollToBottom } from "@/components/chat/use-scroll-to-bottom";
import { DeviceFrame } from "@/components/frame/device-frame";
import { PAGE_SHEET_TRANSITION_MS, PhonePageSheet } from "@/components/frame/phone-sheet";
import { PhoneStatusBar } from "@/components/frame/phone-status-bar";
import type { MessagingApp as MessagingAppId } from "@/components/frame/views";
import { LoginForm } from "@/components/login-form";
import type { FoundProduct } from "@/lib/chat/shopify-catalog";
import type { AgentCard } from "@agent-commerce/core";
import type { Money } from "@/lib/chat/payment-choice";
import type { BuyerDetailsOutcome, PaymentChoiceOutcome } from "@/lib/chat/tools";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import {
  ArrowUpIcon,
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleCheckIcon,
  ImageIcon,
  LockIcon,
  MicIcon,
  PhoneIcon,
  ListIcon,
  PlusIcon,
  ReplyIcon,
  StickerIcon,
  VideoIcon,
} from "./messaging-icons";
import { brandAttr, loginNext, type ExperienceProps } from "./types";
import "./messaging.css";

const DONE_LINGER_MS = 800;

/** The first bubble of every thread. It stays when the conversation starts. */
const WELCOME = `Hi, I am ${AGENT_NAME}. What can I get you?`;

/**
 * The app as a conversation in a chat app. The agent is a contact; what it
 * needs from the user arrives as links, and each link opens a page over the
 * thread the way the phone's browser would. Tool work stays out of sight.
 *
 * One thread, three chromes: iMessage, WhatsApp and Instagram Direct, picked
 * by `app`. The chrome imitates the real app and keeps its colours; the
 * pages that open over it are ours and wear the chosen brand.
 */
export function MessagingApp(props: ExperienceProps) {
  const Chrome = CHROMES[props.app];
  return (
    <DeviceFrame className="flex-1 md:flex-none" reserveTop={props.reserveTop}>
      <div
        className={cn(
          "msg relative flex h-full min-h-0 flex-col text-[15px] leading-[1.3]",
          `msg-${props.app}`,
        )}
      >
        <PhoneStatusBar />
        {props.signedIn ? (
          <SignedIn {...props} Chrome={Chrome} />
        ) : (
          <SignedOut {...props} Chrome={Chrome} />
        )}
      </div>
    </DeviceFrame>
  );
}

// ---------------------------------------------------------------------------
// The thread as bubbles
// ---------------------------------------------------------------------------

type Side = "sent" | "recv";

/** The product a payment choice is for, as `choiceSubject` reads it. */
type ChoiceSubject = ReturnType<typeof choiceSubject>;

/** Where a payment choice stands in the messaging thread, once it is one step on. */
type ChoiceStep = "card" | "other";

type Bubble =
  | { key: string; kind: "text"; side: Side; text: string }
  /** A link to one of our pages. `path` is shown under the agent's domain; the page itself opens in a sheet. */
  | {
      key: string;
      kind: "link";
      side: "recv";
      title: string;
      path: string;
      done?: string;
      onOpen?: () => void;
    }
  | { key: string; kind: "status"; text: string }
  /** Products the agent found or suggests, as picture bubbles. A tap picks one. */
  | {
      key: string;
      kind: "products";
      products: FoundProduct[];
      onPick: (message: string) => void;
      onOpen: (product: FoundProduct) => void;
    }
  /** One stretch of a checkout: the task and its steps, ticking off. */
  | {
      key: string;
      kind: "run";
      site: CheckoutSite;
      title: string;
      steps: CheckoutStep[];
      startedAt?: string;
      endedAt?: string;
      folded: "latest" | "title";
    }
  /** Where the agent went, said once: the site's icon and a small line over the next bubble. */
  | { key: string; kind: "site"; site: CheckoutSite }
  /** A checkout that went through, as the receipt card a business sends. */
  | { key: string; kind: "receipt"; receipt: ReceiptData }
  /** Quick replies under a message, like the buttons a business chat offers. A tap sends one. */
  | ChoicesBubble;

/**
 * Quick replies under the welcome, drawn the way each app draws the ones a
 * business can send: WhatsApp's reply buttons, iMessage's quick replies,
 * Instagram's quick-reply pills. A tap sends the choice as the user's message.
 */
interface ChoicesBubble {
  key: string;
  kind: "choices";
  choices: Array<{ label: string; message: string; description?: string }>;
  onPick: (message: string) => void;
  /** Once the chat has started. WhatsApp keeps its buttons, spent; the others take theirs away. */
  used: boolean;
}

/** A store's password request, open in the browser sheet. */
type PasswordAsk = { toolCallId: string; checkoutId: string; requestId: string; domain: string };

type Approval = {
  requestId: string;
  /** Set when a checkout's payment step raised this, so the sheet says so. */
  paying?: boolean;
} & (
  | { toolCallId: string }
  /** A new card made at a payment choice: its ending goes back to the choice. */
  | { onDone: (outcome: ApproveOutcome) => void }
);

/** A new card made at a payment choice, waiting for or past its approval. */
type NewCardAsk = { requestId: string; budget?: Money };

/** The thread as a flat list of bubbles. A message with two text parts is two bubbles; a tool call is none. */
function toBubbles(
  messages: ChatMessage[],
  watches: WatchIndex,
  live: ReadonlyMap<string, LiveWatch>,
  onReview: (a: Approval) => void,
  onEnterPassword: (ask: PasswordAsk) => void,
  onAddCard: (toolCallId: string) => void,
  onAddDetails: (toolCallId: string) => void,
  onBuyerDetails: (toolCallId: string, outcome: BuyerDetailsOutcome) => void,
  onPaymentChoice: (toolCallId: string, outcome: PaymentChoiceOutcome) => void,
  /** The user's agent cards, for the ones Card can offer again; undefined until they are in. */
  agentCards: AgentCard[] | undefined,
  /** The payment choices one step on, by tool call: Card or Another way was picked. */
  choiceSteps: ReadonlyMap<string, ChoiceStep>,
  onChoiceStep: (toolCallId: string, step: ChoiceStep) => void,
  /** The new cards made at payment choices, by tool call. */
  newCards: ReadonlyMap<string, NewCardAsk>,
  /** Card with no agent card that fits, or New card: make one and open its approval. */
  onNewCard: (toolCallId: string, subject: ChoiceSubject, option: PaymentOption) => void,
  /** Open a new card's approval again, from its link. */
  onReviewCard: (toolCallId: string) => void,
  onPick: (message: string) => void,
  onOpen: (product: FoundProduct) => void,
): Bubble[] {
  const out: Bubble[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      const text = m.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();
      if (text) out.push({ key: m.id, kind: "text", side: "sent", text });
      continue;
    }
    if (m.role !== "assistant") continue;
    m.parts.forEach((part, i) => {
      const key = `${m.id}-${i}`;
      if (part.type === "text") {
        if (part.text.trim()) out.push({ key, kind: "text", side: "recv", text: part.text.trim() });
        return;
      }
      if (
        part.type === "tool-await_agent_card_approval" &&
        (part.state === "input-available" || part.state === "output-available")
      ) {
        const request = findRequest(m, part.input.requestId);
        // A checkout waiting on this is the user choosing how to pay, not an
        // agent asking for a budget out of the blue.
        const paying =
          watches.paymentRequests.has(part.input.requestId) ||
          Boolean(findPaymentStep(m, part.input.requestId));
        const title = paying
          ? "Choose how to pay"
          : request
            ? `Approve ${formatAmount(request.amount.value, request.amount.currency)} for ${request.description}`
            : "Approve a budget";
        const done =
          part.state === "output-available"
            ? part.output.status === "active"
              ? "Approved"
              : part.output.status === "denied"
                ? "Denied"
                : part.output.status === "expired"
                  ? "Expired"
                  : "Failed"
            : undefined;
        out.push({
          key,
          kind: "link",
          side: "recv",
          title,
          path: `/approve/${part.input.requestId}`,
          done,
          onOpen: done
            ? undefined
            : () =>
                onReview({ toolCallId: part.toolCallId, requestId: part.input.requestId, paying }),
        });
        return;
      }
      // Adding a card: a link to the wallet, where Crossmint's card form takes it.
      if (
        part.type === "tool-await_saved_card" &&
        (part.state === "input-available" || part.state === "output-available")
      ) {
        const done =
          part.state === "output-available"
            ? part.output.status === "saved"
              ? "Saved"
              : "Skipped"
            : undefined;
        out.push({
          key,
          kind: "link",
          side: "recv",
          title: "Add a card",
          path: "/wallet",
          done,
          onOpen: done ? undefined : () => onAddCard(part.toolCallId),
        });
        return;
      }
      // The first purchase: a link to the details form, and Not now as a quick reply.
      if (
        part.type === "tool-await_buyer_details" &&
        (part.state === "input-available" || part.state === "output-available")
      ) {
        const done =
          part.state === "output-available"
            ? part.output.status === "saved"
              ? "Saved"
              : "Skipped"
            : undefined;
        out.push({ key: `${key}-text`, kind: "text", side: "recv", text: BUYER_DETAILS_QUESTION });
        out.push({
          key,
          kind: "link",
          side: "recv",
          title: "Add your details",
          path: "/details",
          done,
          onOpen: done ? undefined : () => onAddDetails(part.toolCallId),
        });
        out.push({
          key: `${key}-later`,
          kind: "choices",
          choices: [{ label: "Not now", message: "skip" }],
          onPick: () => onBuyerDetails(part.toolCallId, { status: "skipped" }),
          used: Boolean(done),
        });
        if (done === "Skipped") {
          out.push({ key: `${key}-reply`, kind: "text", side: "sent", text: "Not now" });
        }
        return;
      }
      // How to pay for a Shopify product: the app's quick replies, and the
      // pick as the user's own reply. Another way is asked in words.
      if (
        part.type === "tool-await_payment_choice" &&
        (part.state === "input-available" || part.state === "output-available")
      ) {
        const subject = choiceSubject(part.input, productFor(watches, part.input.url));
        const output = part.state === "output-available" ? part.output : undefined;
        const fitting = fittingCards(agentCards, part.input.url, subject);
        const step = choiceSteps.get(part.toolCallId);
        const answer = (option: PaymentOption) =>
          onPaymentChoice(part.toolCallId, paymentChoiceOutcome(option, subject.budget));
        // A list of options as the app's quick replies. A tap hands its option to `onOption`.
        const replies = (
          replyKey: string,
          options: PaymentOption[],
          used: boolean,
          onOption: (option: PaymentOption) => void,
        ): Bubble => ({
          key: replyKey,
          kind: "choices",
          choices: options.map((o) => ({
            label: o.label,
            message: optionKey(o),
            description: o.detail,
          })),
          onPick: (picked) => {
            const option = options.find((o) => optionKey(o) === picked);
            if (option) onOption(option);
          },
          used,
        });
        out.push({
          key: `${key}-text`,
          kind: "text",
          side: "recv",
          text: paymentChoiceQuestion(subject.item),
        });
        // Until the cards are in, so Card knows whether to ask about them.
        if (!output && !agentCards) return;
        const ways = paymentOptions(subject.budget);
        // The new card, from this session or from the answer of a chat opened again.
        const made =
          newCards.get(part.toolCallId) ??
          (output?.requestId ? { requestId: output.requestId, budget: output.budget } : undefined);
        out.push(
          replies(key, ways, Boolean(output || step || made), (option) => {
            if (option.method === "card" && fitting.length) onChoiceStep(part.toolCallId, "card");
            else if (option.method === "card") onNewCard(part.toolCallId, subject, option);
            else if (option.method === "other") onChoiceStep(part.toolCallId, "other");
            else answer(option);
          }),
        );
        // One step on: the pick as the user's reply, the question, and its options.
        if (step) {
          out.push({
            key: `${key}-step-reply`,
            kind: "text",
            side: "sent",
            text: ways.find((o) => o.method === step)?.label ?? "",
          });
          out.push({
            key: `${key}-step-text`,
            kind: "text",
            side: "recv",
            text: step === "card" ? CARD_STEP_QUESTION : OTHER_STEP_QUESTION,
          });
          out.push(
            replies(
              `${key}-step`,
              step === "card"
                ? cardOptions(subject.budget, fitting)
                : [...otherOptions(), SOMETHING_ELSE],
              Boolean(output || made),
              (option) =>
                option.method === "card"
                  ? onNewCard(part.toolCallId, subject, option)
                  : answer(option),
            ),
          );
        }
        // A new card: the pick as the user's reply, and a link to approve it.
        if (made) {
          out.push({
            key: `${key}-card-reply`,
            kind: "text",
            side: "sent",
            text: step === "card" ? "New card" : "Card",
          });
          out.push({
            key: `${key}-card`,
            kind: "link",
            side: "recv",
            title: made.budget
              ? `Approve up to ${formatAmount(made.budget.value, made.budget.currency)}`
              : "Approve the new card",
            path: `/approve/${made.requestId}`,
            done: output ? (output.approval === "active" ? "Approved" : "Not approved") : undefined,
            onOpen: output ? undefined : () => onReviewCard(part.toolCallId),
          });
        }
        // The pick as the user's reply, unless the new card's link already carries it.
        if (output && !made) {
          out.push({
            key: `${key}-reply`,
            kind: "text",
            side: "sent",
            text: paymentChoiceLabel(output),
          });
        }
        return;
      }
      // A password: a link to the checkout's page, where Crossmint's field takes it.
      const password = passwordRequestOf(part, watches);
      if (
        password &&
        part.type === "tool-await_protected_input" &&
        (part.state === "input-available" || part.state === "output-available")
      ) {
        const done =
          part.state === "output-available"
            ? part.output.status === "submitted"
              ? "Sent"
              : "Skipped"
            : undefined;
        out.push({
          key,
          kind: "link",
          side: "recv",
          title: `Sign in to ${password.domain}`,
          path: `/checkouts/${password.checkoutId}`,
          done,
          onOpen: done
            ? undefined
            : () => onEnterPassword({ toolCallId: part.toolCallId, ...password }),
        });
        return;
      }
      // What a search or a look-up found, as picture bubbles, under the line
      // the agent put on the call.
      const message = productsMessageOf(part);
      const products = productsOf(part);
      if (message || products?.length) {
        if (message) out.push({ key: `${key}-text`, kind: "text", side: "recv", text: message });
        if (products?.length) out.push({ key, kind: "products", products, onPick, onOpen });
        return;
      }
      // A checkout that went through: the receipt, under the agent's line on it.
      const receiptLine = receiptMessageOf(part);
      const receipt = receiptOf(part);
      if (receiptLine || receipt) {
        if (receiptLine) {
          out.push({ key: `${key}-text`, kind: "text", side: "recv", text: receiptLine });
        }
        if (receipt) out.push({ key, kind: "receipt", receipt });
        return;
      }
      // Starting a checkout shows the site it runs on, and where it stands.
      const site = part.type === "tool-create_checkout" ? checkoutSiteOf(part) : undefined;
      if (part.type === "tool-create_checkout" && site) {
        const failed =
          part.state === "output-error" ||
          (part.state === "output-available" &&
            Boolean((part.output as { error?: unknown } | undefined)?.error));
        // The steps card names the site once the run is followed; until then, a line.
        const followed = site.checkoutId && watches.firstWatch.has(site.checkoutId);
        if (!failed && !followed) out.push({ key, kind: "site", site });
        return;
      }
      // Each watch is one stretch of the checkout, as a card of steps: live
      // while the run goes, from the output after.
      if (
        part.type === "tool-watch_checkout" &&
        (part.state === "input-available" || part.state === "output-available")
      ) {
        // The next stretch took this card over: the agent answered the question itself.
        if (watches.absorbed.has(part.toolCallId)) return;
        const checkoutId = part.input.checkoutId;
        const carried = watches.carried.get(part.toolCallId);
        const site = watches.sites.get(checkoutId) ?? { host: "the store" };
        const done = part.state === "output-available";
        const now = live.get(part.toolCallId);
        const continuing =
          watches.firstWatch.get(checkoutId) !== (carried?.chainStart ?? part.toolCallId);
        const steps = runSteps({
          host: site.host,
          continuing,
          updates: [
            ...(carried?.updates ?? []),
            ...(done ? (part.output.updates ?? []) : (now?.updates ?? [])),
          ],
          live: !done,
          outcome: done ? part.output : undefined,
        });
        out.push({
          key,
          kind: "run",
          site,
          title: runTitle(site, continuing),
          steps,
          startedAt: carried?.startedAt ?? (done ? part.output.startedAt : now?.startedAt),
          endedAt: done ? (part.output.endedAt ?? part.output.startedAt) : undefined,
          folded: done && stoppedForUser(part.output) ? "title" : "latest",
        });
      }
    });
  }
  return out;
}

function sideOf(b: Bubble | undefined): Side | undefined {
  return b && (b.kind === "text" || b.kind === "link") ? b.side : undefined;
}

/** A bubble with its place in the thread: first or last of a run from one side, when it arrived, and whether it is the newest sent one. */
interface Placed {
  bubble: Extract<Bubble, { kind: "text" | "link" }>;
  first: boolean;
  last: boolean;
  time: string;
  seen: boolean;
}

function clock(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * The scrolling thread, shared by the three chromes. Each chrome hands over
 * its canvas, its date line, its status line style and how to draw a bubble.
 */
function Thread({
  bubbles,
  working,
  className,
  dateLine,
  statusClassName,
  renderBubble,
  renderChoices,
}: {
  bubbles: Bubble[];
  working: boolean;
  className?: string;
  dateLine: (opened: string) => ReactNode;
  statusClassName: string;
  renderBubble: (placed: Placed) => ReactNode;
  /** Quick replies in the thread, the app's way. Leave it out for an app that shows them elsewhere. */
  renderChoices?: (bubble: ChoicesBubble) => ReactNode;
}) {
  const { containerRef } = useScrollToBottom(bubbles.length);
  const [opened] = useState(clock);
  // Each bubble keeps the time it first appeared.
  const [times] = useState(() => new Map<string, string>());
  const timeFor = (key: string) => {
    let t = times.get(key);
    if (!t) {
      t = clock();
      times.set(key, t);
    }
    return t;
  };
  let lastSent = -1;
  bubbles.forEach((b, i) => {
    if ((b.kind === "text" || b.kind === "link") && b.side === "sent") lastSent = i;
  });

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        className={cn("absolute inset-0 overflow-y-auto scrollbar-none", className)}
      >
        <div className="flex min-h-full flex-col justify-end px-3 pt-3 pb-1">
          {dateLine(opened)}
          {bubbles.map((b, i) => {
            if (b.kind === "status") {
              return (
                <p key={b.key} className={statusClassName}>
                  {b.text}
                </p>
              );
            }
            if (b.kind === "products") {
              // A product message: the picture on top, the name and price under it.
              return (
                <div
                  key={b.key}
                  className={cn("mr-auto mb-2 flex w-[70%] flex-col gap-1.5", ENTER)}
                >
                  {b.products.map((p) => (
                    // A tap on the product opens its details; only Buy picks it.
                    <div
                      key={p.url}
                      className="overflow-hidden rounded-2xl border border-current/15 bg-white text-black"
                    >
                      <button
                        type="button"
                        aria-label={`Details: ${p.title}`}
                        onClick={() => b.onOpen(p)}
                        className="block w-full text-left transition-opacity active:opacity-70"
                      >
                        <ProductImage
                          src={p.image}
                          alt={p.title}
                          className="aspect-[4/3] bg-white"
                        />
                        <span className="flex flex-col gap-0.5 border-t border-black/10 px-3 py-2">
                          <span className="line-clamp-2 text-[13px] leading-snug font-semibold">
                            {p.title}
                          </span>
                          <span className="truncate text-[12px] opacity-60">
                            {[p.price, p.store].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => b.onPick(pickMessage(p))}
                        className="flex h-10 w-full items-center justify-center border-t border-black/10 text-[15px] font-semibold text-[#027eb5] transition-colors active:bg-black/5"
                      >
                        Buy
                      </button>
                    </div>
                  ))}
                </div>
              );
            }
            if (b.kind === "run") {
              return (
                <div key={b.key} className={cn("mr-auto mb-2 w-[82%]", ENTER)}>
                  <CheckoutRunCard
                    site={b.site}
                    title={b.title}
                    steps={b.steps}
                    startedAt={b.startedAt}
                    endedAt={b.endedAt}
                    folded={b.folded}
                    compact
                  />
                </div>
              );
            }
            if (b.kind === "receipt") {
              // The card draws its own surface, as the landing's thread shows it.
              return (
                <div key={b.key} className={cn("mr-auto mb-2 w-[78%]", ENTER)}>
                  <Receipt receipt={b.receipt} />
                </div>
              );
            }
            if (b.kind === "site") {
              return (
                <div
                  key={b.key}
                  className={cn(
                    "mb-1 flex items-center gap-1.5 pl-1 text-[11px] opacity-60",
                    ENTER,
                  )}
                >
                  <SiteIcon host={b.site.host} size={13} />
                  <span className="min-w-0 truncate">{siteLine(b.site)}</span>
                </div>
              );
            }
            if (b.kind === "choices") {
              return renderChoices ? (
                <div key={b.key} className={ENTER}>
                  {renderChoices(b)}
                </div>
              ) : null;
            }
            const first = sideOf(bubbles[i - 1]) !== b.side;
            const last = sideOf(bubbles[i + 1]) !== b.side;
            return (
              <div
                key={b.key}
                className={cn(
                  "flex flex-col",
                  last ? "mb-2" : "mb-[3px]",
                  b.side === "sent" ? ENTER_SENT : ENTER,
                )}
              >
                {renderBubble({
                  bubble: b,
                  first,
                  last,
                  time: timeFor(b.key),
                  seen: i === lastSent,
                })}
              </div>
            );
          })}
          {working ? <p className={statusClassName}>{AGENT_NAME} is working…</p> : null}
        </div>
      </div>
    </div>
  );
}

/** A link bubble is a button while its page can still be opened. */
function LinkShell({
  onOpen,
  className,
  children,
}: {
  onOpen?: () => void;
  className: string;
  children: ReactNode;
}) {
  return onOpen ? (
    <button type="button" onClick={onOpen} className={className}>
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** The URL a link bubble shows. Display only: the page opens in a sheet over the thread. */
function linkUrl(path: string): string {
  return `https://${AGENT_DOMAIN}${path}`;
}

// ---------------------------------------------------------------------------
// The composer's state, shared by the three bars
// ---------------------------------------------------------------------------

interface ComposerProps {
  disabled: boolean;
  busy: boolean;
  onSend: (text: string) => void;
}

function useComposer({ disabled, busy, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = !disabled && !busy && text.trim().length > 0;

  function submit() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    inputRef.current?.focus();
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const inputProps = {
    ref: inputRef,
    value: text,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setText(e.target.value),
    onKeyDown,
    disabled,
  };
  return { typing: text.length > 0, canSend, onSubmit, inputProps };
}

// ---------------------------------------------------------------------------
// The three chromes
// ---------------------------------------------------------------------------

interface ChromeProps {
  bubbles: Bubble[];
  working: boolean;
  composer: ComposerProps;
}

type Chrome = (props: ChromeProps) => ReactNode;

// iMessage -----------------------------------------------------------------

function IMessageChrome({ bubbles, working, composer }: ChromeProps) {
  return (
    <>
      {/* Three columns, so the contact sits in the true centre whatever the sides measure. */}
      <div className="im-bar grid grid-cols-[1fr_auto_1fr] items-end border-b px-3 pt-1 pb-2">
        <span className="im-blue mb-3 flex items-center justify-self-start text-[15px]">
          <ChevronLeftIcon width={28} height={28} strokeWidth={2.2} className="-ml-1" />
          Messages
        </span>
        <span className="flex flex-col items-center gap-1">
          <AgentAvatar size={44} />
          <span className="flex items-center text-[11px] leading-none">
            {AGENT_NAME}
            <ChevronRightIcon width={10} height={10} strokeWidth={3} className="im-gray ml-px" />
          </span>
        </span>
        <VideoIcon
          width={24}
          height={24}
          strokeWidth={1.8}
          className="im-blue mb-3 justify-self-end"
        />
      </div>

      <Thread
        bubbles={bubbles}
        working={working}
        dateLine={(opened) => (
          <p className="im-gray mb-3 text-center text-[11px]">
            <span className="font-semibold">Today</span> {opened}
          </p>
        )}
        statusClassName="im-gray my-1 text-center text-[11px] font-medium"
        renderBubble={(p) => <IMessageBubble {...p} />}
        renderChoices={(b) => <IMessageQuickReplies bubble={b} />}
      />

      <IMessageComposer {...composer} />
    </>
  );
}

/**
 * iMessage's quick replies: capsules under the message, gone once one is
 * picked. Outlined in iMessage blue on white, so they read as buttons and not
 * as more grey bubbles.
 */
function IMessageQuickReplies({ bubble }: { bubble: ChoicesBubble }) {
  const { choices, onPick, used } = bubble;
  if (used) return null;
  return (
    <div className="mb-2 flex max-w-[85%] flex-wrap gap-1.5">
      {choices.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c.message)}
          className="im-quick rounded-full border-[1.5px] bg-white px-3.5 py-[7px] text-[15px] leading-tight font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors active:bg-[#0a84ff]/10"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function IMessageBubble({ bubble, last }: Placed) {
  const sent = bubble.side === "sent";
  const skin = cn(
    "im-bubble rounded-[18px]",
    sent ? "im-sent-bubble ml-auto" : "im-recv-bubble mr-auto",
    last && (sent ? "im-tail-sent" : "im-tail-recv"),
  );

  if (bubble.kind === "link") {
    return (
      <LinkShell onOpen={bubble.onOpen} className={cn(skin, "w-[78%] overflow-hidden text-left")}>
        <div className="flex flex-col">
          <div className="im-preview-art flex h-[72px] items-center justify-center">
            <AgentMark size={40} />
          </div>
          <div className="flex flex-col gap-px px-3 py-2">
            <span className="truncate text-[13px] leading-tight font-semibold">
              {bubble.done ?? bubble.title}
            </span>
            <span className="im-gray truncate text-[11px]">
              {bubble.done ? bubble.title : AGENT_DOMAIN}
            </span>
          </div>
        </div>
      </LinkShell>
    );
  }

  return (
    <div className={cn(skin, "max-w-[78%] px-3 py-1.5 break-words whitespace-pre-wrap")}>
      {/* A span, so the text paints above the tail's blobs. */}
      <span>{bubble.text}</span>
    </div>
  );
}

function IMessageComposer(props: ComposerProps) {
  const { canSend, onSubmit, inputProps } = useComposer(props);
  return (
    <form className="flex shrink-0 items-center gap-2 px-3 pt-1.5 pb-7" onSubmit={onSubmit}>
      <span className="im-gray im-plus inline-flex size-8 shrink-0 items-center justify-center rounded-full">
        <PlusIcon width={18} height={18} strokeWidth={2.2} />
      </span>
      <div className="im-field flex h-9 min-w-0 flex-1 items-center rounded-full border pr-[3px] pl-3">
        <input
          {...inputProps}
          placeholder="iMessage"
          aria-label="iMessage"
          className="msg-input min-w-0 flex-1 bg-transparent text-[16px] outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
            canSend ? "im-send" : "im-gray im-plus",
          )}
        >
          <ArrowUpIcon width={16} height={16} strokeWidth={3} />
        </button>
      </div>
    </form>
  );
}

// WhatsApp -----------------------------------------------------------------

/** WhatsApp takes three reply buttons at most; past that a business sends a list message. */
const WA_MAX_BUTTONS = 3;

function WhatsAppChrome({ bubbles, working, composer }: ChromeProps) {
  // The list message whose options are open, over the whole chat.
  const [list, setList] = useState<ChoicesBubble | null>(null);
  return (
    <>
      <div className="wa-bar flex items-center gap-2 border-b px-2 pt-1 pb-2">
        <ChevronLeftIcon width={28} height={28} strokeWidth={2.2} className="wa-blue shrink-0" />
        <AgentAvatar size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[16px] font-semibold">{AGENT_NAME}</p>
          <p className="wa-gray text-[12px]">online</p>
        </div>
        <VideoIcon width={26} height={26} strokeWidth={1.8} className="wa-blue shrink-0" />
        <PhoneIcon width={22} height={22} strokeWidth={1.8} className="wa-blue mx-1.5 shrink-0" />
      </div>

      <Thread
        bubbles={bubbles}
        working={working}
        className="wa-canvas"
        dateLine={() => (
          <div className="mb-3 flex justify-center">
            <span className="wa-date rounded-[8px] px-2.5 py-1 text-[12px] font-medium shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
              Today
            </span>
          </div>
        )}
        statusClassName="wa-date wa-status mx-auto my-1 rounded-[8px] px-2.5 py-1 text-center text-[12px] font-medium shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]"
        renderBubble={(p) => <WhatsAppBubble {...p} />}
        renderChoices={(b) =>
          b.choices.length > WA_MAX_BUTTONS ? (
            <WhatsAppListButton bubble={b} onOpen={() => setList(b)} />
          ) : (
            <WhatsAppReplyButtons bubble={b} />
          )
        }
      />

      <WhatsAppComposer {...composer} />

      {list ? <WhatsAppListSheet bubble={list} onClose={() => setList(null)} /> : null}
    </>
  );
}

/**
 * WhatsApp's reply buttons: one white strip per option under the message, as
 * wide as it, the label in link blue beside a reply arrow. They stay in the
 * thread after the chat has started, spent.
 */
function WhatsAppReplyButtons({ bubble }: { bubble: ChoicesBubble }) {
  const { choices, onPick, used } = bubble;
  return (
    <div className="-mt-1 mb-2 flex w-[80%] flex-col gap-[2px]">
      {choices.map((c) => (
        <button
          key={c.label}
          type="button"
          disabled={used}
          onClick={() => onPick(c.message)}
          className="wa-recv wa-bubble flex h-10 items-center justify-center rounded-[8px] text-[15px] font-medium transition-colors enabled:active:bg-black/5 disabled:cursor-default"
        >
          {/* The bubble's own colour is black; the label wears the link blue. */}
          <span className="wa-link flex items-center gap-1.5">
            <ReplyIcon width={16} height={16} />
            {c.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * A WhatsApp list message's button: one strip under the message, like a reply
 * button, that opens the options. Spent once the chat has started.
 */
function WhatsAppListButton({ bubble, onOpen }: { bubble: ChoicesBubble; onOpen: () => void }) {
  return (
    <div className="-mt-1 mb-2 flex w-[80%] flex-col">
      <button
        type="button"
        disabled={bubble.used}
        onClick={onOpen}
        className="wa-recv wa-bubble flex h-10 items-center justify-center rounded-[8px] text-[15px] font-medium transition-colors enabled:active:bg-black/5 disabled:cursor-default"
      >
        <span className="wa-link flex items-center gap-1.5">
          <ListIcon width={16} height={16} />
          Choose an option
        </span>
      </button>
    </div>
  );
}

/**
 * The options of a WhatsApp list message: a sheet up from the bottom of the
 * chat, one row per option with a radio on the right, and Send to reply with
 * the one picked.
 */
function WhatsAppListSheet({ bubble, onClose }: { bubble: ChoicesBubble; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choice = bubble.choices.find((c) => c.label === picked);
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 duration-200 animate-in fade-in-0"
      />
      <div
        role="dialog"
        aria-label="Choose an option"
        className="relative flex max-h-[80%] flex-col rounded-t-[14px] bg-white pb-7 duration-300 animate-in slide-in-from-bottom"
      >
        <span className="mx-auto mt-2 h-1 w-9 rounded-full bg-black/15" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-2 pb-3">
          <button
            type="button"
            onClick={onClose}
            className="wa-gray justify-self-start text-[22px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
          <p className="text-[16px] font-semibold">Choose an option</p>
        </div>
        <ul className="min-h-0 overflow-y-auto border-t border-black/10">
          {bubble.choices.map((c) => {
            const on = c.label === picked;
            return (
              <li key={c.label} className="border-b border-black/10">
                <button
                  type="button"
                  onClick={() => setPicked(c.label)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] leading-snug">{c.label}</span>
                    {c.description ? (
                      <span className="wa-time text-[13px] leading-snug">{c.description}</span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      on ? "border-[#00a884]" : "border-black/25",
                    )}
                  >
                    {on ? <span className="size-2.5 rounded-full bg-[#00a884]" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-4 pt-3">
          <button
            type="button"
            disabled={!choice}
            onClick={() => {
              if (!choice) return;
              bubble.onPick(choice.message);
              onClose();
            }}
            className="h-11 w-full rounded-full bg-[#00a884] text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppBubble({ bubble, first, time }: Placed) {
  const sent = bubble.side === "sent";
  const skin = cn(
    "wa-bubble rounded-[8px]",
    sent ? "wa-sent ml-auto" : "wa-recv mr-auto",
    first && (sent ? "wa-tail-sent rounded-tr-none" : "wa-tail-recv rounded-tl-none"),
  );
  // Floats to the right of the last line when it fits, else onto a line of its own, as in WhatsApp.
  const meta = (
    <span className="wa-time float-right mt-[7px] ml-2 flex items-center gap-1 text-[11px] leading-none">
      {time}
      {sent ? <DoubleCheckIcon width={16} height={16} className="wa-ticks" /> : null}
    </span>
  );

  if (bubble.kind === "link") {
    return (
      <LinkShell onOpen={bubble.onOpen} className={cn(skin, "w-[80%] p-[3px] text-left")}>
        <div className="wa-preview flex flex-col gap-0.5 rounded-[6px] px-3 py-2.5">
          <span className="text-[14px] leading-tight font-semibold">
            {bubble.done ?? bubble.title}
          </span>
          <span className="wa-time text-[12px] leading-tight">
            {bubble.done ? bubble.title : `${AGENT_NAME} is waiting for your answer.`}
          </span>
          <span className="wa-time text-[12px]">{AGENT_DOMAIN}</span>
        </div>
        <div className="flow-root px-2 pt-1.5 pb-1">
          <span className="wa-link text-[15px] break-all underline">{linkUrl(bubble.path)}</span>
          {meta}
        </div>
      </LinkShell>
    );
  }

  return (
    <div className={cn(skin, "max-w-[80%] flow-root px-2 py-1.5")}>
      <span className="break-words whitespace-pre-wrap">{bubble.text}</span>
      {meta}
    </div>
  );
}

function WhatsAppComposer(props: ComposerProps) {
  const { typing, canSend, onSubmit, inputProps } = useComposer(props);
  return (
    <form
      className="wa-bar flex shrink-0 items-center gap-2 border-t px-2 pt-1.5 pb-7"
      onSubmit={onSubmit}
    >
      <PlusIcon width={26} height={26} strokeWidth={2} className="wa-blue shrink-0" />
      <div className="wa-field flex h-9 min-w-0 flex-1 items-center rounded-full border pr-2 pl-3">
        <input
          {...inputProps}
          placeholder="Message"
          aria-label="Message"
          className="msg-input min-w-0 flex-1 bg-transparent text-[16px] outline-none disabled:opacity-60"
        />
        <StickerIcon width={22} height={22} strokeWidth={1.8} className="wa-gray shrink-0" />
      </div>
      {typing ? (
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="wa-send inline-flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
        >
          <ArrowUpIcon width={18} height={18} strokeWidth={2.5} />
        </button>
      ) : (
        <>
          <CameraIcon width={24} height={24} strokeWidth={1.8} className="wa-blue shrink-0" />
          <MicIcon width={24} height={24} strokeWidth={1.8} className="wa-blue mr-0.5 shrink-0" />
        </>
      )}
    </form>
  );
}

// Instagram Direct ---------------------------------------------------------

function InstagramChrome({ bubbles, working, composer }: ChromeProps) {
  return (
    <>
      <div className="ig-hairline flex items-center gap-2 border-b px-2 pt-1 pb-2.5">
        <ChevronLeftIcon width={26} height={26} strokeWidth={2} className="shrink-0" />
        <AgentAvatar size={34} className="rounded-full ring-1 ring-black/10" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-semibold">{AGENT_NAME}</p>
          <p className="ig-gray text-[12px]">Active now</p>
        </div>
        <PhoneIcon width={24} height={24} strokeWidth={1.8} className="shrink-0" />
        <VideoIcon width={26} height={26} strokeWidth={1.8} className="mx-1.5 shrink-0" />
      </div>

      <Thread
        bubbles={bubbles}
        working={working}
        dateLine={(opened) => (
          <p className="ig-gray mb-3 text-center text-[11px] font-medium">Today {opened}</p>
        )}
        statusClassName="ig-gray my-1 text-center text-[11px] font-medium"
        renderBubble={(p) => <InstagramBubble {...p} />}
        renderChoices={(b) => <InstagramQuickReplies bubble={b} />}
      />

      <InstagramComposer {...composer} />
    </>
  );
}

function InstagramBubble({ bubble, first, last, seen }: Placed) {
  const sent = bubble.side === "sent";
  // Bubbles in a run flatten the corners that face each other.
  const radius = sent
    ? cn("rounded-[18px]", !first && "rounded-tr-[5px]", !last && "rounded-br-[5px]")
    : cn("rounded-[18px]", !first && "rounded-tl-[5px]", !last && "rounded-bl-[5px]");
  const skin = sent ? "ig-sent" : "ig-recv";

  const body =
    bubble.kind === "link" ? (
      <LinkShell onOpen={bubble.onOpen} className={cn("w-[80%] p-1.5 text-left", radius, skin)}>
        <div className="ig-preview flex flex-col overflow-hidden rounded-[14px]">
          <div className="ig-preview-art flex h-[70px] items-center justify-center">
            <AgentMark size={40} />
          </div>
          <div className="flex flex-col gap-px px-3 py-2">
            <span className="truncate text-[13px] leading-tight font-semibold">
              {bubble.done ?? bubble.title}
            </span>
            <span className="ig-gray truncate text-[11px]">
              {bubble.done ? bubble.title : AGENT_DOMAIN}
            </span>
          </div>
        </div>
      </LinkShell>
    ) : (
      <div
        className={cn("max-w-[78%] px-3 py-[7px] break-words whitespace-pre-wrap", radius, skin)}
      >
        {bubble.text}
      </div>
    );

  if (sent) {
    return (
      <>
        <div className="flex justify-end">{body}</div>
        {seen ? <span className="ig-gray mt-[3px] pr-1 text-right text-[11px]">Seen</span> : null}
      </>
    );
  }
  return (
    <div className="flex items-end gap-1.5">
      {/* The avatar sits by the last bubble of a run; a spacer keeps the others aligned. */}
      {last ? (
        <AgentAvatar size={24} className="rounded-full ring-1 ring-black/10" />
      ) : (
        <span className="w-6 shrink-0" />
      )}
      {body}
    </div>
  );
}

/**
 * Instagram's quick replies: pills under the message, lined up with its
 * bubbles past the avatar, wrapping so every one shows. Outlined and lettered
 * in Instagram's blue so they read as buttons; gone once one is picked.
 */
function InstagramQuickReplies({ bubble }: { bubble: ChoicesBubble }) {
  const { choices, onPick, used } = bubble;
  if (used) return null;
  return (
    <div className="mb-2 flex max-w-[85%] flex-wrap gap-1.5 pl-[30px]">
      {choices.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c.message)}
          className="ig-quick rounded-full border-[1.5px] bg-white px-3.5 py-[7px] text-[14px] leading-tight font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-colors active:bg-[#0095f6]/10"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function InstagramComposer(props: ComposerProps) {
  const { typing, canSend, onSubmit, inputProps } = useComposer(props);
  return (
    <form className="shrink-0 px-2.5 pt-1.5 pb-7" onSubmit={onSubmit}>
      <div className="ig-field flex h-11 items-center gap-2 rounded-full pr-3 pl-1">
        <span className="ig-sent inline-flex size-9 shrink-0 items-center justify-center rounded-full">
          <CameraIcon width={19} height={19} strokeWidth={2} />
        </span>
        <input
          {...inputProps}
          placeholder="Message..."
          aria-label="Message"
          className="msg-input min-w-0 flex-1 bg-transparent text-[16px] outline-none disabled:opacity-60"
        />
        {typing ? (
          <button
            type="submit"
            disabled={!canSend}
            className="ig-send shrink-0 text-[15px] font-semibold disabled:opacity-60"
          >
            Send
          </button>
        ) : (
          <>
            <MicIcon width={22} height={22} strokeWidth={1.8} className="shrink-0" />
            <ImageIcon width={22} height={22} strokeWidth={1.8} className="shrink-0" />
            <StickerIcon width={22} height={22} strokeWidth={1.8} className="shrink-0" />
          </>
        )}
      </div>
    </form>
  );
}

const CHROMES: Record<MessagingAppId, Chrome> = {
  imessage: IMessageChrome,
  whatsapp: WhatsAppChrome,
  instagram: InstagramChrome,
};

// ---------------------------------------------------------------------------
// Signed in
// ---------------------------------------------------------------------------

function SignedIn({
  chat,
  thread,
  email,
  chatEnabled,
  brand,
  Chrome,
}: ExperienceProps & { Chrome: Chrome }) {
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [password, setPassword] = useState<PasswordAsk | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  // The add_card call whose form is open in the browser sheet.
  const [addCard, setAddCard] = useState<string | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  // The product whose details are open. It keeps its value through the
  // slide-out, so the page does not go blank while leaving.
  const [product, setProduct] = useState<FoundProduct | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const openProduct = useCallback((p: FoundProduct) => {
    setProduct(p);
    setProductOpen(true);
  }, []);
  const closeProduct = useCallback(() => {
    setProductOpen(false);
    setTimeout(() => setProduct(null), PAGE_SHEET_TRANSITION_MS);
  }, []);
  // What pending watches have to say so far, by tool call, for the bubbles.
  const [live, setLive] = useState<ReadonlyMap<string, LiveWatch>>(() => new Map());
  const onUpdates = useCallback((toolCallId: string, watch: LiveWatch) => {
    setLive((prev) => new Map(prev).set(toolCallId, watch));
  }, []);
  const watches = useMemo(() => watchIndex(chat.messages), [chat.messages]);
  const pending = pendingWatches(chat.messages);

  const onReview = useCallback((a: Approval) => {
    setApproval(a);
    setApprovalOpen(true);
  }, []);
  const closeApproval = useCallback(() => {
    setApprovalOpen(false);
    setTimeout(() => setApproval(null), PAGE_SHEET_TRANSITION_MS);
  }, []);
  const onApprovalDone = useCallback(
    (o: ApproveOutcome) => {
      if (approval && "onDone" in approval) approval.onDone(o);
      else if (approval) chat.onApprovalOutcome(approval.toolCallId, toApprovalOutcome(o));
      setTimeout(closeApproval, DONE_LINGER_MS);
    },
    [approval, chat, closeApproval],
  );

  const onEnterPassword = useCallback((ask: PasswordAsk) => {
    setPassword(ask);
    setPasswordOpen(true);
  }, []);
  const closePassword = useCallback(() => {
    setPasswordOpen(false);
    setTimeout(() => setPassword(null), PAGE_SHEET_TRANSITION_MS);
  }, []);
  const onAddCard = useCallback((toolCallId: string) => {
    setAddCard(toolCallId);
    setAddCardOpen(true);
  }, []);
  const closeAddCard = useCallback(() => {
    setAddCardOpen(false);
    setTimeout(() => setAddCard(null), PAGE_SHEET_TRANSITION_MS);
  }, []);
  const onCardSavedHere = useCallback(
    (result: SaveCardResult) => {
      if (addCard) chat.onCardSaved(addCard, savedCardOutcome(result));
      setTimeout(closeAddCard, DONE_LINGER_MS);
    },
    [addCard, chat, closeAddCard],
  );
  const onPasswordDone = useCallback(
    (status: PasswordRequestOutcome) => {
      if (password) chat.onPasswordOutcome(password.toolCallId, { status });
      setTimeout(closePassword, DONE_LINGER_MS);
    },
    [password, chat, closePassword],
  );
  // The await_buyer_details call whose form is open, from its link.
  const [details, setDetails] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const onAddDetails = useCallback((toolCallId: string) => {
    setDetails(toolCallId);
    setDetailsOpen(true);
  }, []);
  // The user's agent cards, read while a payment choice waits: it offers the ones that fit.
  const choosing = Boolean(pendingCall(chat.messages, "tool-await_payment_choice"));
  const agentCards = useAgentCards({ enabled: choosing });
  const cardsIn = agentCards.data ?? (agentCards.error ? [] : undefined);
  const [choiceSteps, setChoiceSteps] = useState<ReadonlyMap<string, ChoiceStep>>(
    () => new Map(),
  );
  const onChoiceStep = useCallback((toolCallId: string, step: ChoiceStep) => {
    setChoiceSteps((prev) => new Map(prev).set(toolCallId, step));
  }, []);
  // New cards made at payment choices. The choice answers once the approval
  // ends: with the card, or that it was not approved.
  const { api } = useAgentCommerce();
  const [newCards, setNewCards] = useState<ReadonlyMap<string, NewCardAsk>>(() => new Map());
  const reviewNewCard = useCallback(
    (toolCallId: string, ask: NewCardAsk) => {
      onReview({
        requestId: ask.requestId,
        // Approved, the card to pay with; not approved, the agent asks how else to pay.
        onDone: (o) =>
          chat.onPaymentChoice(
            toolCallId,
            approvedCardOutcome(o, ask.budget, ask.requestId) ?? {
              method: "card",
              requestId: ask.requestId,
              approval: toApprovalOutcome(o).status,
              ...(ask.budget ? { budget: ask.budget } : {}),
            },
          ),
      });
    },
    [chat, onReview],
  );
  const onNewCard = useCallback(
    async (toolCallId: string, subject: ChoiceSubject, option: PaymentOption) => {
      const request = newCardRequest(subject);
      // No price to budget from: the checkout's payment step approves the total.
      if (!request) {
        chat.onPaymentChoice(toolCallId, paymentChoiceOutcome(option, subject.budget));
        return;
      }
      try {
        const made = await api.createAgentCardRequest(request);
        const ask = { requestId: made.id, budget: subject.budget };
        // Its approval opens from the link, never by itself.
        setNewCards((prev) => new Map(prev).set(toolCallId, ask));
      } catch (err) {
        chat.reportError(errorMessage(err));
      }
    },
    [api, chat],
  );
  const onReviewCard = useCallback(
    (toolCallId: string) => {
      const ask = newCards.get(toolCallId);
      if (ask) reviewNewCard(toolCallId, ask);
    },
    [newCards, reviewNewCard],
  );
  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    setTimeout(() => setDetails(null), PAGE_SHEET_TRANSITION_MS);
  }, []);
  const onDetailsDone = useCallback(
    (outcome: BuyerDetailsOutcome) => {
      if (details) chat.onBuyerDetails(details, outcome);
      setTimeout(closeDetails, outcome.status === "saved" ? DONE_LINGER_MS : 0);
    },
    [details, chat, closeDetails],
  );

  const bubbles: Bubble[] = [
    chatEnabled
      ? { key: "hello", kind: "text", side: "recv", text: WELCOME }
      : {
          key: "off",
          kind: "text",
          side: "recv",
          text: "Chat is off. Set ANTHROPIC_API_KEY or OPENAI_API_KEY to turn it on.",
        },
    // The three ways to start, as quick replies under the welcome.
    ...(chatEnabled && !thread.loading
      ? [
          {
            key: "starters",
            kind: "choices" as const,
            choices: STARTERS.map((s) => ({
              label: s.title,
              message: s.message,
            })),
            onPick: chat.send,
            used: chat.messages.length > 0,
          },
        ]
      : []),
    ...toBubbles(
      chat.messages,
      watches,
      live,
      onReview,
      onEnterPassword,
      onAddCard,
      onAddDetails,
      chat.onBuyerDetails,
      chat.onPaymentChoice,
      cardsIn,
      choiceSteps,
      onChoiceStep,
      newCards,
      (toolCallId, subject, option) => void onNewCard(toolCallId, subject, option),
      onReviewCard,
      chat.send,
      openProduct,
    ),
  ];
  if (thread.loading) bubbles.push({ key: "loading", kind: "status", text: "Loading…" });
  if (chat.error) bubbles.push({ key: "error", kind: "status", text: chat.error });

  return (
    <>
      <Chrome
        bubbles={bubbles}
        // A checkout in progress keeps the agent "working" between its updates.
        working={chat.busy || pending.length > 0}
        composer={{ disabled: !chatEnabled, busy: chat.busy, onSend: chat.send }}
      />

      <BrowserSheet
        open={productOpen}
        path="/products"
        brand={brand}
        onDone={closeProduct}
        ariaLabel="Product"
      >
        {product ? (
          <ProductDetails
            product={product}
            onBuy={() => {
              chat.send(pickMessage(product));
              closeProduct();
            }}
          />
        ) : null}
      </BrowserSheet>

      <BrowserSheet
        open={approvalOpen}
        path={`/approve/${approval?.requestId ?? ""}`}
        brand={brand}
        onDone={closeApproval}
        ariaLabel="Approve"
      >
        {approval ? (
          <ApproveAgentCard
            key={approval.requestId}
            requestId={approval.requestId}
            variant="plain"
            platformName={PLATFORM_NAME}
            ask={approval.paying ? PAYMENT_STEP_ASK : undefined}
            onDone={onApprovalDone}
          />
        ) : null}
      </BrowserSheet>

      <BrowserSheet
        open={passwordOpen}
        path={`/checkouts/${password?.checkoutId ?? ""}`}
        brand={brand}
        onDone={closePassword}
        ariaLabel="Sign in"
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
      </BrowserSheet>

      <BrowserSheet
        open={addCardOpen}
        path="/wallet"
        brand={brand}
        onDone={closeAddCard}
        ariaLabel="Add a card"
      >
        {addCard ? <SaveCard key={addCard} showResult={false} onSaved={onCardSavedHere} /> : null}
      </BrowserSheet>

      <BrowserSheet
        open={detailsOpen}
        path="/details"
        brand={brand}
        onDone={closeDetails}
        ariaLabel="Your details"
      >
        {details ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[22px] leading-tight font-semibold">Your details</h2>
              <p className="text-sm text-muted-foreground">{BUYER_DETAILS_NOTE}</p>
            </div>
            <BuyerDetailsSheetBody key={details} email={email} onOutcome={onDetailsDone} />
          </div>
        ) : null}
      </BrowserSheet>

      {pending.map((w) => (
        <CheckoutWatcher
          key={w.toolCallId}
          toolCallId={w.toolCallId}
          checkoutId={w.checkoutId}
          watches={watches}
          onOutcome={chat.onCheckoutOutcome}
          onUpdates={onUpdates}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Signed out
// ---------------------------------------------------------------------------

function SignedOut(props: ExperienceProps & { Chrome: Chrome }) {
  const { onSignedIn, brand, Chrome } = props;
  const [open, setOpen] = useState(false);
  const bubbles: Bubble[] = [
    {
      key: "hello",
      kind: "text",
      side: "recv",
      text: `Hi, I am ${AGENT_NAME}. Log in and tell me what to buy for you.`,
    },
    {
      key: "login",
      kind: "link",
      side: "recv",
      title: "Log in",
      path: "/login",
      onOpen: () => setOpen(true),
    },
  ];
  return (
    <>
      <Chrome
        bubbles={bubbles}
        working={false}
        composer={{ disabled: true, busy: false, onSend: () => undefined }}
      />
      <BrowserSheet
        open={open}
        path="/login"
        brand={brand}
        onDone={() => setOpen(false)}
        ariaLabel="Log in"
      >
        <LoginForm
          next={loginNext(props)}
          onSignedIn={() => {
            setOpen(false);
            onSignedIn();
          }}
        />
      </BrowserSheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// A page over the thread, drawn like the phone's in-app browser: Done to
// leave, the address in the middle. The page under it is ours and wears the
// brand; the bar does not.
// ---------------------------------------------------------------------------

function BrowserSheet({
  open,
  path,
  brand,
  onDone,
  ariaLabel,
  children,
}: {
  open: boolean;
  path: string;
  brand: ExperienceProps["brand"];
  onDone: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <PhonePageSheet open={open} ariaLabel={ariaLabel}>
      <div className="msg-browser-bar flex items-center gap-3 border-b px-3 pt-4 pb-2 md:pt-14">
        <button
          type="button"
          onClick={onDone}
          className="msg-browser-action w-11 shrink-0 text-left text-[15px] font-semibold"
        >
          Done
        </button>
        <span className="msg-browser-url flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[13px]">
          <LockIcon width={12} height={12} strokeWidth={2.4} className="shrink-0" />
          <span className="truncate">
            {AGENT_DOMAIN}
            {path}
          </span>
        </span>
        <span aria-hidden className="w-11 shrink-0" />
      </div>
      <div
        data-brand={brandAttr(brand)}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground scrollbar-none"
      >
        <div className="px-6 py-6">{children}</div>
      </div>
    </PhonePageSheet>
  );
}
