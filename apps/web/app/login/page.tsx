import type { Metadata } from "next";
import { GridRule } from "@/components/landing/grid";
import { PoweredBy } from "@/components/landing/powered-by";
import { Container } from "@/components/landing/section";
import { FocusScreen } from "@/components/focus-screen";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  // Same-origin paths only.
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/wallet";
  return v;
}

/**
 * Sign in on the shared focus ground. The powered-by strip gets its own row
 * under a rule at the foot, as on the landing, which is also why the hero's
 * pixel block is left out here — it would sit behind the logos.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  return (
    <FocusScreen
      footer={
        <>
          <GridRule />
          <Container className="relative py-8">
            <PoweredBy />
          </Container>
        </>
      }
    >
      {/* The form owns the heading: it names the step, and the step changes
          once a code is on its way. */}
      <LoginForm next={next} />
    </FocusScreen>
  );
}
