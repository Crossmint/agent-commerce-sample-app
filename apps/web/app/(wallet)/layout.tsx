import { chatEnabled } from "@/lib/chat/config";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Every wallet page needs a signed-in user. proxy.ts sends visitors without a
 * cookie to /login with `next`. This layout verifies the cookie for real.
 */
export default async function WalletLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // One root element: the router scrolls the new page into view on arrival,
  // and with several roots it can pick the last one and open at the foot.
  return (
    <div className="flex flex-1 flex-col">
      <Nav email={session.email} chatEnabled={chatEnabled()} />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
