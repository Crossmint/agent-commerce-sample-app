import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * A checkout is watched on a page of its own, outside the app's screens, so
 * the link an agent sends opens straight onto it. The session is verified
 * here the way the approve layout does it, and a signed-out visitor comes
 * back to this checkout after logging in.
 */
export default async function CheckoutLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    const { id } = await params;
    redirect(`/login?next=${encodeURIComponent(`/checkouts/${id}`)}`);
  }
  return <>{children}</>;
}
