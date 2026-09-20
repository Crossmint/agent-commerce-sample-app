import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Approving a budget is one decision on a page of its own, so it gets no nav
 * and none of the wallet's chrome — only the focus ground, as on sign in.
 * The session is still verified here the way the wallet layout does it:
 * proxy.ts only checks that a cookie exists.
 */
export default async function ApproveLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <>{children}</>;
}
