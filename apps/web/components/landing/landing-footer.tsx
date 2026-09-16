import Image from "next/image";
import { Container } from "./section";

/** The GOAT logo and what the name stands for. Nothing else. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border/70 py-12">
      <Container className="flex flex-col items-start gap-4">
        <Image src="/brand/logo.png" alt="GOAT" width={2170} height={725} unoptimized className="h-7 w-auto" />
        <p className="text-sm text-muted-foreground sm:text-base">
          <Initial>G</Initial>reat <Initial>O</Initial>pen source <Initial>A</Initial>gentic payment <Initial>T</Initial>emplates
        </p>
      </Container>
    </footer>
  );
}

/** One letter of the acronym, set so it stands out from the muted words. */
function Initial({ children }: { children: string }) {
  return <span className="font-bold text-primary">{children}</span>;
}
