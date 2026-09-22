"use client";

import { ApproveAgentCard } from "@agent-commerce/ui";
import { PLATFORM_NAME } from "@/components/brand";

/**
 * The approval screen inside the phone: the page draws the dot grid and the
 * device frame, so the component itself runs "plain". A panel inside the
 * screen would be a second frame around the same content. Every ending says
 * what happened and leaves the tab to be closed, so there is no button back
 * into the app.
 *
 * `platformName` is what the card network shows in its confirmation window:
 * the platform the card is saved with, never the agent asking.
 */
export function ApproveScreen({ requestId }: { requestId: string }) {
  return <ApproveAgentCard requestId={requestId} variant="plain" platformName={PLATFORM_NAME} />;
}
