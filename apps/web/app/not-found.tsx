import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@agent-commerce/ui";
import { FocusScreen, ScreenHeading } from "@/components/focus-screen";

export const metadata: Metadata = { title: "Not found" };

/** Every unmatched URL, on the same phone screen as sign in. */
export default function NotFound() {
  return (
    <FocusScreen>
      <div className="flex flex-1 flex-col gap-6">
        <ScreenHeading title="This page is not here." sub="The link may be old, or the request it pointed at may be gone. Nothing was charged." />
        <div className="mt-auto flex flex-col gap-2">
          <Button asChild size="xl" className="w-full">
            <Link href="/app">Open the app</Link>
          </Button>
          <Button asChild variant="secondary" size="xl" className="w-full">
            <Link href="/">Back to the home page</Link>
          </Button>
        </div>
      </div>
    </FocusScreen>
  );
}
