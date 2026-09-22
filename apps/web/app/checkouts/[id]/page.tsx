import type { Metadata } from "next";
import { CheckoutScreen } from "@/components/checkout-screen";
import { DesktopFrame } from "@/components/frame/desktop-frame";
import { FramePage } from "@/components/frame/frame-page";

export const metadata: Metadata = { title: "Checkout" };

/** The address shown in the window's pill: the deployment's host when it is known. */
function addressFor(id: string): string {
  const base = process.env.AGENT_COMMERCE_WEB_BASE_URL;
  const path = `/checkouts/${id}`;
  if (!base) return path;
  try {
    return `${new URL(base).host}${path}`;
  } catch {
    return path;
  }
}

/**
 * Watching a checkout is a desktop job: the live browser Crossmint provides
 * needs the width. So the page is a desktop window on the dot grid, with the
 * checkout scrolling inside it, rather than the phone the other standalone
 * screens use.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <FramePage>
      <DesktopFrame address={addressFor(id)}>
        <div className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
          <CheckoutScreen checkoutId={id} />
        </div>
      </DesktopFrame>
    </FramePage>
  );
}
