import { APPROVE_LAYOUTS } from "./approve-variants";
import { DEFAULT_BRAND, type Brand } from "./brands";
import { MobileBrowser } from "./mobile-browser";
import { PhoneFrame } from "./phone-frame";

export interface ApproveScreenMockProps {
  /** Which fictional brand renders the screen. Default GOAT. */
  brand?: Brand;
  /** Host in the browser bar. Default: the brand's domain. */
  domain?: string;
  agentName?: string;
  className?: string;
}

/** The approval screen inside a phone, inside a mobile browser. Purely visual. */
export function ApproveScreenMock({ brand = DEFAULT_BRAND, domain, agentName = "Your agent", className }: ApproveScreenMockProps) {
  const Screen = APPROVE_LAYOUTS[brand.id];
  const light = brand.tone === "light";
  return (
    <PhoneFrame
      className={className}
      statusTone={light ? "dark" : "light"}
      screenClassName={light ? "bg-[#f2f2f7]" : "bg-[#1c1c1e]"}
      label={`The ${brand.name} approval screen: ${agentName} asks for $8.00 on a saved Visa`}
    >
      <div className="landing-theme h-full text-foreground" style={brand.vars}>
        <MobileBrowser domain={domain ?? brand.domain} tone={brand.tone}>
          <Screen agentName={agentName} />
        </MobileBrowser>
      </div>
    </PhoneFrame>
  );
}
