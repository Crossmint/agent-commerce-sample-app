"use client";

import { ApproveAgentCard } from "@goat-wallet/ui";

/**
 * The approval screen on the focus ground: the page draws the dotted
 * backdrop and the grid cell, so the component itself runs "plain" — a panel
 * inside the cell would be a second frame around the same content. Every
 * ending says what happened and leaves the tab to be closed, so there is no
 * button back into the wallet.
 */
export function ApproveScreen({ requestId }: { requestId: string }) {
  return <ApproveAgentCard requestId={requestId} variant="plain" />;
}
