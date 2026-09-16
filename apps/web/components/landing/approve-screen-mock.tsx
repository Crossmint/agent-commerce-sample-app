import { APPROVE_LAYOUTS } from "./approve-variants";
import { type Brand, DEFAULT_BRAND } from "./brands";
import { MobileBrowser } from "./mobile-browser";
import { PhoneFrame } from "./phone-frame";

export interface ApproveScreenMockProps {
  /** Which brand renders the screen. Default: the generic template screen. */
  brand?: Brand;
  /** Host in the browser bar. Default: the brand's domain. */
  domain?: string;
  /** Name of the agent asking. Default: the brand name. */
  agentName?: string;
  className?: string;
  /** Frame width in CSS px at full size. Default 300. */
  width?: number;
}

/** Screen classes for the phone behind an approval screen. */
export const APPROVE_SCREEN_BG = { light: "bg-[#f2f2f7]", dark: "bg-[#1c1c1e]" } as const;

/** The approval screen inside a phone, inside a mobile browser. Purely visual. */
export function ApproveScreenMock({ brand = DEFAULT_BRAND, domain, agentName, className, width }: ApproveScreenMockProps) {
  const light = brand.tone === "light";
  return (
    <PhoneFrame
      className={className}
      width={width}
      statusTone={light ? "dark" : "light"}
      screenClassName={APPROVE_SCREEN_BG[brand.tone]}
      label={`The ${brand.name} approval screen on ${domain ?? brand.domain}: ${agentName ?? brand.name} asks for access to a saved card`}
    >
      <ApproveScreen brand={brand} domain={domain} agentName={agentName} />
    </PhoneFrame>
  );
}

export type ApproveScreenProps = Omit<ApproveScreenMockProps, "className" | "width">;

/** The approval screen without the phone. Use it to stack screens inside one `PhoneFrame`. */
export function ApproveScreen({ brand = DEFAULT_BRAND, domain, agentName }: ApproveScreenProps) {
  const Screen = APPROVE_LAYOUTS[brand.approval];
  return (
    <div key={brand.id} className="landing-fade h-full">
      <MobileBrowser domain={domain ?? brand.domain} tone={brand.tone}>
        <Screen agentName={agentName ?? brand.name} logo={brand.id === "goat" ? undefined : brand.logo} />
      </MobileBrowser>
    </div>
  );
}
