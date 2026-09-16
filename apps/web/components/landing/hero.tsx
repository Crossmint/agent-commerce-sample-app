import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@goat-wallet/ui";
import { HeroPhone } from "./hero-phone";
import { Container } from "./section";

const rise = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section className="goat-backdrop relative overflow-hidden">
      <Container className="grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <Image src="/brand/logo.png" alt="GOAT Wallet" width={2170} height={725} priority unoptimized className="landing-rise h-auto w-[40vw] max-w-[220px]" style={rise(0)} />
          <h1 className="landing-rise max-w-xl text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl" style={rise(60)}>
            An open source alternative to Link
          </h1>
          <p className="landing-rise max-w-xl text-lg leading-snug text-foreground/90 sm:text-xl" style={rise(110)}>
            Give your agents a card and check out at millions of merchants. Your brand, your users.
          </p>
          <div className="landing-rise flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row" style={rise(220)}>
            <Button asChild size="lg">
              <Link href="#try">Try it live</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#build">Build your own</Link>
            </Button>
          </div>
        </div>

        <HeroPhone className="landing-rise relative mx-auto w-full max-w-[var(--phone-w)] lg:mr-0" />
      </Container>
    </section>
  );
}
