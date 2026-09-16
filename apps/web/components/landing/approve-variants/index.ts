import type { ComponentType } from "react";
import type { BrandId } from "../brands";
import { ForgeApprove } from "./forge";
import { GoatApprove } from "./goat";
import { NimbusApprove } from "./nimbus";
import type { ApproveLayoutProps } from "./types";

export type { ApproveLayoutProps } from "./types";
export { ForgeApprove, GoatApprove, NimbusApprove };

/** One approval layout per fictional brand. They differ in structure, not only in color. */
export const APPROVE_LAYOUTS: Record<BrandId, ComponentType<ApproveLayoutProps>> = {
  goat: GoatApprove,
  nimbus: NimbusApprove,
  forge: ForgeApprove,
};
