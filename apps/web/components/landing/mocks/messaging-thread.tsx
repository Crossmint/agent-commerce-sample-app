import type { ChatMessage } from "../chat/model";
import { ReceiptCard } from "../receipt-card";
import { STORY } from "../story";

/*
 * The story over a messaging app, shared by the iMessage, WhatsApp and
 * Instagram mocks: the agent has no screen of its own, so it sends the
 * approval link and the receipt as messages. Replays on a loop while in view.
 */

export const MESSAGING_T = {
  ask: 300,
  reply: 1300,
  link: 2000,
  approved: 3700,
  ordered: 4700,
  receipt: 5400,
  loop: 10000,
} as const;

export function messagingThread(): ChatMessage[] {
  return [
    { key: "ask", from: "user", at: MESSAGING_T.ask, node: STORY.ask },
    {
      key: "reply",
      from: "agent",
      at: MESSAGING_T.reply,
      node: <>Sure. I need a {STORY.amount} budget for that. Approve it here:</>,
    },
    {
      key: "link",
      from: "agent",
      at: MESSAGING_T.link,
      link: {
        domain: STORY.agentDomain,
        title: `Approve ${STORY.amount} for ${STORY.agent}`,
        description: `${STORY.purpose} · one purchase`,
        url: STORY.approveUrl,
      },
    },
    {
      key: "approved",
      from: "status",
      at: MESSAGING_T.approved,
      node: (
        <>
          You approved {STORY.amount} · {STORY.card}
        </>
      ),
    },
    {
      key: "ordered",
      from: "agent",
      at: MESSAGING_T.ordered,
      node: (
        <>
          Ordered at {STORY.domain}. Order #{STORY.order} arrives Thursday.
        </>
      ),
    },
    { key: "receipt", from: "agent", at: MESSAGING_T.receipt, bare: true, card: <ReceiptCard /> },
  ];
}

/** The phone's accessible description, for one app. */
export const messagingLabel = (app: string) =>
  `A ${app} thread: the user asks ${STORY.agent} to ${STORY.ask.toLowerCase()}, the agent sends an approval link on ${STORY.agentDomain} for ${STORY.amount}, the user approves, and a receipt for ${STORY.receipt.total} arrives`;
