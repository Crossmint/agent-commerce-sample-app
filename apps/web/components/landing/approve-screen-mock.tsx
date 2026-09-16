import { APPROVE_VARIANTS, type ApproveState } from "./approve-variants";
import { type Brand, DEFAULT_BRAND } from "./brands";
import { CardEntryScreen } from "./card-entry";
import { MobileBrowser } from "./mobile-browser";

/** Screen classes for the phone behind an approval page. */
export const APPROVE_SCREEN_BG = { light: "bg-[#f2f2f7]", dark: "bg-[#1c1c1e]" } as const;

export interface ApproveScreenProps {
  /** Which brand renders the page. Default: the generic template page. */
  brand?: Brand;
  /** Host in the browser bar. Default: the brand's domain. */
  domain?: string;
  /** Name of the agent asking. Default: the brand name. */
  agentName?: string;
  state: ApproveState;
}

/**
 * The approval page in a mobile browser, without the phone. Stack it inside
 * one `PhoneFrame` with the other screens of the story. Purely visual.
 */
export function ApproveScreen({ brand = DEFAULT_BRAND, domain, agentName, state }: ApproveScreenProps) {
  const { Screen } = APPROVE_VARIANTS[brand.approval];
  return (
    <MobileBrowser domain={domain ?? brand.domain} tone={brand.tone}>
      <Screen agentName={agentName ?? brand.name} logo={brand.id === "goat" ? undefined : brand.logo} state={state} />
    </MobileBrowser>
  );
}

/** The card entry page in the same browser, in the brand's form theme. */
export function CardEntryPage({ brand = DEFAULT_BRAND, domain, agentName }: Omit<ApproveScreenProps, "state">) {
  const { form } = APPROVE_VARIANTS[brand.approval];
  return (
    <MobileBrowser domain={domain ?? brand.domain} path="/cards/new" tone={brand.tone}>
      <CardEntryScreen theme={form} agentName={agentName ?? brand.name} />
    </MobileBrowser>
  );
}
