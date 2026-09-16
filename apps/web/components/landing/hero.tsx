import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@goat-wallet/ui";
import { Container } from "./section";
import { DOCS_URL } from "./links";
import { MessageThreadMock } from "./message-thread-mock";

const rise = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section className="goat-backdrop relative overflow-hidden">
      <Container className="grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <p className="landing-rise inline-flex flex-wrap items-center gap-x-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground" style={rise(0)}>
            <span>Open source</span>
            <span aria-hidden className="text-primary">
              ·
            </span>
            <span>White-label</span>
            <span aria-hidden className="text-primary">
              ·
            </span>
            <span>Powered by Crossmint</span>
          </p>
          <h1 className="landing-rise text-6xl font-extrabold tracking-tighter sm:text-7xl lg:text-8xl" style={rise(80)}>
            GOAT Wallet
          </h1>
          <p className="landing-rise max-w-xl text-xl leading-snug text-balance text-foreground/90 sm:text-2xl" style={rise(160)}>
            The open source, white-label evolution of Link. Your users save a card once. Your agents pay anywhere.
          </p>
          <div className="landing-rise flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row" style={rise(240)}>
            <Button asChild size="lg">
              <Link href="#try">Try it with your agent</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={DOCS_URL} target="_blank" rel="noreferrer">
                Read the docs
              </a>
            </Button>
          </div>
        </div>

        <div className="landing-rise relative mx-auto mt-10 w-full max-w-md sm:mt-6 lg:mt-0" style={rise(200)}>
          <div aria-hidden className="landing-glow absolute -inset-16 -z-10" />
          <Image
            src="/brand/mark.png"
            alt="The GOAT mascot"
            width={725}
            height={725}
            priority
            className="landing-float absolute -top-16 right-1 z-10 w-32 drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)] select-none sm:-top-20 sm:-left-12 sm:right-auto sm:w-44 lg:-left-16 lg:w-52"
            draggable={false}
          />
          <div className="goat-window">
            <MessageThreadMock frame="plain" />
          </div>
        </div>
      </Container>
    </section>
  );
}
