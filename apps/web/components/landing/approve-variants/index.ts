import type { ApprovalLayout } from "../brands";
import { botbot } from "./botbot";
import { goat } from "./goat";
import { impulse } from "./impulse";
import { lumen } from "./lumen";
import type { ApproveVariant } from "./types";

export type { ApproveLayoutProps, ApproveState, ApproveVariant, CardFormTheme } from "./types";

/** One approval page and card form theme per brand. They differ in structure, not only in color. */
export const APPROVE_VARIANTS: Record<ApprovalLayout, ApproveVariant> = { goat, impulse, lumen, botbot };
