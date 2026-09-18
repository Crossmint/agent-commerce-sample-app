import type { Metadata } from "next";
import Link from "next/link";
import { GoatLockup } from "@/components/brand";
import { GridCell, GridRule } from "@/components/landing/grid";
import { PoweredBy } from "@/components/landing/powered-by";
import { Container } from "@/components/landing/section";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  // Same-origin paths only.
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/wallet";
  return v;
}

/**
 * Sign in, on the landing page's ground: the dotted backdrop, the halftone
 * bleeding in from the top right, and the form in one cell of the hairline
 * grid with a green diamond at each corner. The powered-by strip gets its own
 * row under a rule at the foot, as on the landing, which is also why the
 * hero's pixel block is left out here — it would sit behind the logos. Copy
 * is left-aligned, as on the landing. The section clips the rules where they
 * bleed past the cell.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="goat-backdrop relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-16 h-[300px] w-[420px] bg-[url(/brand/agents/texture-halftone-green.png)] bg-cover bg-right-top opacity-30 [mask-image:linear-gradient(to_bottom_left,#000_20%,transparent_72%)] sm:-right-24 sm:h-[460px] sm:w-[640px]"
      />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="relative w-full max-w-md">
          {/* The verticals stop on the cell's own rules: run past, they would
              carry on down through the logo strip at the foot. */}
          <GridCell bleed={false} />
          <div className="flex flex-col gap-7 px-6 py-10 sm:px-9 sm:py-12">
            <Link href="/" aria-label="GOAT home" className="self-start">
              <GoatLockup size="md" />
            </Link>
            {/* The form owns the heading: it names the step, and the step
                changes once a code is on its way. */}
            <LoginForm next={next} />
          </div>
        </div>
      </div>

      {/* Its own row under a full-bleed rule, as on the landing. */}
      <GridRule />
      <Container className="relative py-8">
        <PoweredBy />
      </Container>
    </main>
  );
}
