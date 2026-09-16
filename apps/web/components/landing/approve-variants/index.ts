import type { ApprovalLayout } from "../brands";
import { goat } from "./goat";
import { grokbot } from "./grokbot";
import { instinct } from "./instinct";
import { muse } from "./muse";
import type { ApproveVariant } from "./types";

export type { ApproveLayoutProps, ApproveState, ApproveVariant, CardFormTheme } from "./types";

/** One approval page and card form theme per brand. They differ in structure, not only in color. */
export const APPROVE_VARIANTS: Record<ApprovalLayout, ApproveVariant> = { goat, instinct, muse, grokbot };
