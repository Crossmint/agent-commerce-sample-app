"use client";

import { AgentAppRun, type AppRunScript } from "./agent-app-run";
import {
  askEntry,
  CHECKOUT_RUN,
  doneEntry,
  grantedEntry,
  lookedAtCardsEntry,
  orderingEntry,
  progressEntry,
  receiptEntry,
  replyEntry,
  requestEntry,
} from "./agent-app-story";

/*
 * Two slices of the hero's run, for the `how-it-works` phone: the approval on
 * its own, and the checkout on its own. Same screen and same pieces as the
 * hero, so the reader sees one app throughout. The thread each one opens with
 * is already settled (`at: 0`); only its own part plays.
 */

/* ---------- Step 2: the approval ---------- */

/**
 * The beats of an approval, ms from mount. Shared, so the brand layouts in
 * `brand-app.tsx` can play the same story on their own shapes and every one
 * of them fits the same loop.
 */
export const APP_APPROVE_T = { up: 1250, ready: 1750, press: 2450, approved: 3000 } as const;

/** When the approval has shown its outcome for a moment. */
export const APP_APPROVE_END = APP_APPROVE_T.approved + 1800;

const APPROVE_SHEET = APP_APPROVE_T;

const APPROVE_SCRIPT: AppRunScript = {
  thread: [
    { at: 0, entry: askEntry() },
    { at: 0, entry: lookedAtCardsEntry() },
    { at: 0, entry: replyEntry() },
    {
      at: 0,
      entry: requestEntry({
        reviewPress: APPROVE_SHEET.up - 350,
        settleAt: APPROVE_SHEET.approved,
      }),
    },
  ],
  // The sheet stays up: this step is about the approval, so it ends on it.
  sheet: APPROVE_SHEET,
};

/** The chat with the approval sheet rising over it, allowed, then approved. */
export function AppApproveScreen() {
  return <AgentAppRun script={APPROVE_SCRIPT} />;
}

/* ---------- Step 3: the checkout ---------- */

const CHECKOUT_AT = {
  ordering: 400,
  progress: 900,
} as const;

const DONE_AT = CHECKOUT_AT.progress + CHECKOUT_RUN + 500;
const RECEIPT_AT = DONE_AT + 550;

/** When the receipt has been on screen for a moment. */
export const APP_CHECKOUT_END = RECEIPT_AT + 1600;

const CHECKOUT_SCRIPT: AppRunScript = {
  thread: [
    { at: 0, entry: askEntry() },
    { at: 0, entry: lookedAtCardsEntry() },
    { at: 0, entry: replyEntry() },
    { at: 0, entry: requestEntry({ settleAt: 0 }) },
    { at: 0, entry: grantedEntry() },
    { at: CHECKOUT_AT.ordering, entry: orderingEntry() },
    { at: CHECKOUT_AT.progress, entry: progressEntry() },
    { at: DONE_AT, entry: doneEntry() },
    { at: RECEIPT_AT, entry: receiptEntry() },
  ],
};

/** The budget already granted: the checkout runs in the thread and the receipt lands. */
export function AppCheckoutScreen() {
  return <AgentAppRun script={CHECKOUT_SCRIPT} />;
}
