import Image from "next/image";
import { Container } from "./section";

/** One row of the rails and infrastructure under GOAT. Full logotypes, one gray (#959AA4), one height. */
const LOGOS: Array<{ name: string; src: string; href: string }> = [
  { name: "Visa", src: "/logos/visa.svg", href: "https://usa.visa.com" },
  { name: "Mastercard", src: "/logos/mastercard.svg", href: "https://www.mastercard.com" },
  { name: "Basis Theory", src: "/logos/basis-theory.svg", href: "https://basistheory.com" },
  { name: "Adyen", src: "/logos/adyen.svg", href: "https://www.adyen.com" },
  { name: "Vercel", src: "/logos/vercel.svg", href: "https://vercel.com" },
  { name: "Crossmint", src: "/logos/crossmint-gray.svg", href: "https://www.crossmint.com" },
];

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
                className="inline-flex h-6 items-center gap-1.5 transition-opacity hover:opacity-80"
              >
                <Image src={logo.src} alt={logo.name} width={160} height={24} unoptimized className="h-6 w-auto" />
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
