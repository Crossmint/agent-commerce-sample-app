import { type ChatMessage, ChatScreen, type ChatStyle, ReceiptCard } from "./chat";
import { CheckIcon } from "./chat/icons";

/**
 * Which part of the story to show.
 * - request: the ask and the agent's approval link.
 * - confirmation: the same thread after approval: the "You approved" line,
 *   "Ordered", and the receipt land; the earlier messages are already there.
 */
export type ThreadVariant = "request" | "confirmation";

export interface MessageThreadScreenProps {
  /** Chat app skin. Default iMessage. */
  style?: ChatStyle;
  variant: ThreadVariant;
  /** Name in the thread header. Default "Your agent". */
  agentName?: string;
  /** Logo for the contact avatar. Default: a neutral robot mark. */
  logo?: string;
  logoStyle?: "fill" | "mark";
  /** Host in the approval link. Default "yourplatform.com". */
  domain?: string;
}

/**
 * A chat thread without the phone: the user asks, the agent asks for a
 * budget and sends the link; later the approval lands and the receipt
 * arrives. Bubbles appear on CSS delays from mount, so the parent remounts
 * it (a key) to replay.
 */
export function MessageThreadScreen({ style = "imessage", variant, agentName = "Your agent", logo, logoStyle, domain = "yourplatform.com" }: MessageThreadScreenProps) {
  return <ChatScreen style={style} name={agentName} logo={logo} logoStyle={logoStyle} messages={script(variant, domain, agentName)} />;
}

/* ---------- Script ---------- */

/** When the last bubble of the request thread lands, ms from mount. */
export const REQUEST_THREAD_END = 1900;
/** When the receipt lands in the confirmation thread, ms from mount. */
export const CONFIRMATION_THREAD_END = 1600;

function script(variant: ThreadVariant, domain: string, agentName: string): ChatMessage[] {
  const ask: ChatMessage = { key: "ask", from: "user", at: 250, node: <>Get me a grande latte from the Starbucks on 5th</> };
  const request: ChatMessage = { key: "request", from: "agent", at: 1300, node: <>On it. I need $8 on your card for this. Approve here:</> };
  const link: ChatMessage = { key: "link", from: "agent", at: REQUEST_THREAD_END, link: { domain, title: `Approve $8.00 for ${agentName}` } };
  const approved: ChatMessage = {
    key: "approved",
    from: "status",
    at: 250,
    node: (
      <span className="inline-flex items-center gap-1">
        <CheckIcon width={11} height={11} />
        You approved $8.00 · Visa •••• 4242
      </span>
    ),
  };
  const done: ChatMessage = { key: "done", from: "agent", at: 1000, node: <>Ordered. Pickup in 6 min.</> };
  const receipt: ChatMessage = { key: "receipt", from: "agent", at: CONFIRMATION_THREAD_END, bare: true, card: <ReceiptCard tone="light" /> };

  if (variant === "request") return [ask, request, link];
  return [{ ...ask, at: 0 }, { ...request, at: 0 }, { ...link, at: 0 }, approved, done, receipt];
}
