/**
 * The kinds of checkout a receipt can be for. Each names the reference its
 * own way (an order, a confirmation, a booking) and has its own icon. Plain,
 * so the chat's tools on the server and the receipt on the client share it.
 */
export const RECEIPT_KINDS = [
  "purchase",
  "food",
  "reservation",
  "tickets",
  "travel",
  "other",
] as const;

export type ReceiptKind = (typeof RECEIPT_KINDS)[number];
