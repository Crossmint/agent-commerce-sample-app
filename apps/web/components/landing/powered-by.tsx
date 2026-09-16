import Image from "next/image";
import { Container } from "./section";

const LOGOS: Array<{ name: string; src: string; href: string; className: string; raster?: boolean }> = [
  { name: "Visa", src: "/logos/visa.svg", href: "https://usa.visa.com", className: "h-6" },
  { name: "Mastercard", src: "/logos/mastercard.svg", href: "https://www.mastercard.com", className: "h-8" },
  { name: "Basis Theory", src: "/logos/basis-theory-icon.png", href: "https://basistheory.com", className: "h-7", raster: true },
  { name: "Adyen", src: "/logos/adyen.svg", href: "https://www.adyen.com", className: "h-8" },
  { name: "Vercel", src: "/logos/vercel.svg", href: "https://vercel.com", className: "h-6" },
  { name: "Crossmint", src: "/logos/crossmint-white.svg", href: "https://www.crossmint.com", className: "h-6" },
];

/**
 * The rails and infrastructure under GOAT. Monochrome marks, one quiet row.
 * Basis Theory ships only its app icon (dark tile, mint glyph), shown as is with its name beside it.
 */
export function PoweredBy() {
  return (
    <section aria-label="Powered by" className="border-y border-border/60">
      <Container className="flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:gap-10">
        <p className="shrink-0 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Powered by</p>
        <ul className="flex flex-wrap items-center gap-x-10 gap-y-5 sm:gap-x-12">
          {LOGOS.map((logo) => (
            <li key={logo.name} className="flex items-center">
              <a
                href={logo.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center opacity-70 transition-opacity hover:opacity-100"
                title={logo.name}
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={120}
                  height={32}
                  unoptimized
                  className={`${logo.className} w-auto ${logo.raster ? "rounded-sm" : ""}`}
                />
                {logo.raster ? <span className="ml-2 text-sm font-semibold text-foreground">Basis Theory</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
