import type { ComponentType } from "react";
import type { ApprovalLayout } from "../brands";
import { GoatApprove } from "./goat";
import { GrokBotApprove } from "./grokbot";
import { InstinctApprove } from "./instinct";
import { MuseApprove } from "./muse";
import type { ApproveLayoutProps } from "./types";

export type { ApproveLayoutProps } from "./types";
export { GoatApprove, GrokBotApprove, InstinctApprove, MuseApprove };

/** One approval layout per brand. They differ in structure, not only in color. */
export const APPROVE_LAYOUTS: Record<ApprovalLayout, ComponentType<ApproveLayoutProps>> = {
  goat: GoatApprove,
  instinct: InstinctApprove,
  muse: MuseApprove,
  grokbot: GrokBotApprove,
};
