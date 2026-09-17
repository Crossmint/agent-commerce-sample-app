import { GoatLockup } from "@/components/brand";
import { GITHUB_URL, X_URL } from "./links";
import { Container } from "./section";
import { GitHubMark, XMark } from "./social-marks";

/** The GOAT lockup, what the name stands for, and the GitHub and X links. */
export function LandingFooter() {
  return (
    <footer className="py-12">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col items-start gap-4">
          <GoatLockup size="md" />
          <p className="text-sm text-muted-foreground sm:text-base">
            <Initial>G</Initial>reat <Initial>O</Initial>pen source <Initial>A</Initial>gentic payment <Initial>T</Initial>emplates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <GitHubMark className="size-4" />
            GitHub
          </a>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <XMark className="size-3.5" />
            @crossmint_ai
          </a>
        </div>
      </Container>
    </footer>
  );
}

/** One letter of the acronym, set so it stands out from the muted words. */
function Initial({ children }: { children: string }) {
  return <span className="font-bold text-primary">{children}</span>;
}
