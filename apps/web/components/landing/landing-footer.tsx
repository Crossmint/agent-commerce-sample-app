import { CrossmintLogo } from "@/components/brand";
import { CONTACT_SALES_URL, DOCS_URL, GITHUB_URL, X_URL } from "./links";
import { Container } from "./section";
import { GitHubMark, XMark } from "./social-marks";

/*
 * `iconOnly` keeps X to its glyph. The X mark reads as the letter, so a mark
 * and the label "X" beside it looked like the link was there twice; the label
 * stays for screen readers.
 */
const LINKS = [
  { href: GITHUB_URL, label: "GitHub", Icon: GitHubMark },
  { href: DOCS_URL, label: "Docs" },
  { href: X_URL, label: "X", Icon: XMark, iconOnly: true },
  { href: CONTACT_SALES_URL, label: "Contact sales" },
] as const;

/** The Crossmint logo and the app name, and the links. Both rows centre on a phone. */
export function LandingFooter() {
  return (
    <footer className="py-12 sm:py-16">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <CrossmintLogo height={20} />
            <span aria-hidden className="h-4 w-px bg-border" />
            <span className="text-sm font-medium text-foreground">Agent Commerce Sample App</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-1">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {"Icon" in l ? <l.Icon className="size-4" /> : null}
                {"iconOnly" in l ? <span className="sr-only">{l.label}</span> : l.label}
              </a>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
