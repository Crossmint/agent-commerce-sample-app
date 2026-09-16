import { MaskLogo } from "./mask-logo";
import { Container } from "./section";

/**
 * One row of the rails and infrastructure under GOAT. Full logotypes at one
 * height, in the page's muted text color: the files fill with
 * `currentColor` and render as masks, so they follow the theme. `w` and
 * `h` are each file's intrinsic size, for the aspect ratio.
 */
const LOGOS: Array<{ name: string; src: string; href: string; w: number; h: number }> = [
  { name: "Crossmint", src: "/logos/crossmint-gray.svg", href: "https://www.crossmint.com", w: 127, h: 24 },
  { name: "Visa", src: "/logos/visa.svg", href: "https://usa.visa.com", w: 58, h: 19 },
  { name: "Mastercard", src: "/logos/mastercard.svg", href: "https://www.mastercard.com", w: 42, h: 26 },
  { name: "Basis Theory", src: "/logos/basis-theory.svg", href: "https://basistheory.com", w: 87, h: 30 },
  { name: "Adyen", src: "/logos/adyen.svg", href: "https://www.adyen.com", w: 80, h: 26 },
  { name: "Vercel", src: "/logos/vercel.svg", href: "https://vercel.com", w: 2048, h: 407 },
];

const HEIGHT = 24;

export function PoweredBy() {
  return (
    <section aria-label="Powered by" className="border-y border-border/60">
      <Container className="flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:gap-10">
        <p className="shrink-0 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Powered by</p>
        <ul className="flex flex-wrap items-center gap-x-10 gap-y-5 sm:gap-x-12">
          {LOGOS.map((logo) => (
            <li key={logo.name} className="flex h-6 items-center">
              <a
                href={logo.href}
                target="_blank"
                rel="noreferrer"
                title={logo.name}
                className="inline-flex h-6 items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <MaskLogo src={logo.src} label={logo.name} width={Math.round((HEIGHT * logo.w) / logo.h)} height={HEIGHT} />
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
