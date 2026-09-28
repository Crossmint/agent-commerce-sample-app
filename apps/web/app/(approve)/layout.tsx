import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Approving a budget is one decision on a page of its own, so it gets none
 * of the app's chrome: only the phone screen on the dot grid, as on sign in.
 * The session is still verified here the way the app layout does it:
 * proxy.ts only checks that a cookie exists.
 */
export default async function ApproveLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <>{children}</>;
}
