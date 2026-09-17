import { GoatLockup } from "@/components/brand";
import { GITHUB_URL, X_URL } from "./links";
import { Container } from "./section";
import { GitHubMark, XMark } from "./social-marks";

/** The GOAT lockup and the GitHub and X links, in the nav's icon buttons. */
export function LandingFooter() {
  return (
    <footer className="py-12">
      <Container className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <GoatLockup size="md" />
        <nav aria-label="Social" className="flex items-center gap-1">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GOAT on GitHub"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <GitHubMark className="size-5" />
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Crossmint on X"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XMark className="size-4" />
          </a>
        </nav>
      </Container>
    </footer>
  );
}
