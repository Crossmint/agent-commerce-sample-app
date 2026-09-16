import { BrandSwitcher } from "./brand-switcher";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

export function BrandsSection() {
  return (
    <Section id="brands" className="border-t border-border/70">
      <SectionHeading title="Make it yours" sub="Same flow, your brand. GOAT ships as components you restyle with a few CSS variables." />
      <Reveal>
        <BrandSwitcher />
      </Reveal>
    </Section>
  );
}
