import Image from "next/image";
import { Container } from "./section";
import { CROSSMINT_URL, GITHUB_URL, TELEGRAM_URL } from "./links";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/70 py-12">
      <Container className="flex flex-col gap-8">
        <p className="text-xl font-semibold tracking-tight sm:text-2xl">
          Questions?{" "}
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            Join our Telegram community.
          </a>
        </p>
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Image src="/brand/mark.png" alt="" width={32} height={32} className="size-8 rounded-full" />
            <span>GOAT Wallet · Open source, MIT</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
              GitHub
            </a>
            <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Telegram
            </a>
            <a href={CROSSMINT_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Built on Crossmint
            </a>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
