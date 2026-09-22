"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { ArrowRight, Blocks, Component, Palette } from "lucide-react";
import { BRAND_THEME_META, type BrandTheme, DEFAULT_BRAND_THEME } from "@/components/brand-themes";
import { BrandPicker } from "@/components/frame/brand-picker";
import { LandingPhone } from "./landing-phone";
import { APPROVE_FULL_END, ApproveScreen } from "./screen-approve";
import { Reveal } from "./reveal";
import { Section } from "./section";
import { STORY } from "./story";
import { useStepLoop } from "./use-step-loop";

/*
 * Section `#brand`: the copy and the brand picker on the left, the phone on
 * the right. The phone sits under a `data-brand` wrapper, so picking a brand
 * redefines every theme token under it and the screens follow: colors,
 * corners, type. The story is keyed on the brand, so a switch restarts it.
 */

const POINTS: Array<{ Icon: typeof Blocks; text: ReactNode }> = [
  {
    Icon: Blocks,
    text: (
      <>
        shadcn components on theme tokens, in <Code>@agent-commerce/ui</Code>.
      </>
    ),
  },
  {
    Icon: Palette,
    text: (
      <>
        One <Code>data-brand</Code> attribute re-themes every screen.
      </>
    ),
  },
  { Icon: Component, text: "Ship your own components and keep the same hooks." },
];

export function MakeItYours() {
  const [brand, setBrand] = useState<BrandTheme>(DEFAULT_BRAND_THEME);
  return (
    <Section id="brand">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal className="flex flex-col items-start gap-6">
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-foreground sm:text-[36px]">
              Make it yours
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              The screens are your components. Change the tokens and the whole flow follows: colors,
              corners, type.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {POINTS.map(({ Icon, text }, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-[15px] leading-snug text-foreground"
              >
                <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-3.5" strokeWidth={2} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-start gap-4">
            <BrandPicker value={brand} onChange={setBrand} />
            <p className="text-[14px] text-muted-foreground">{BRAND_THEME_META[brand].tagline}</p>
          </div>
          <Link
            href={`/app?brand=${brand}`}
            className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-primary underline-offset-4 hover:underline"
          >
            Try the brands in the app
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="flex justify-center lg:justify-end">
          <BrandPhone brand={brand} />
        </div>
      </div>
    </Section>
  );
}

const LABEL = `A phone in the chosen brand: the user asks ${STORY.agent} to ${STORY.ask.toLowerCase()}, the agent asks for a ${STORY.amount} budget, the approval sheet slides up, the user allows it, and Approved shows`;

/**
 * The approval story in the chosen brand, on a loop. The `data-brand`
 * wrapper is transparent, so only the phone wears the brand; the phone's
 * bezel and screen read the tokens under it.
 */
function BrandPhone({ brand }: { brand: BrandTheme }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: APPROVE_FULL_END + 700 });
  return (
    <div ref={ref} data-brand={brand} className="flex" style={{ backgroundColor: "transparent" }}>
      <LandingPhone key={brand} label={LABEL}>
        <ApproveScreen key={`${brand}-${cycle}`} state="full" />
      </LandingPhone>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
      {children}
    </code>
  );
}
