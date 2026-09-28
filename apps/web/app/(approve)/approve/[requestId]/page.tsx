import type { Metadata } from "next";
import { ApproveScreen } from "@/components/approve-screen";
import { FocusScreen } from "@/components/focus-screen";

export const metadata: Metadata = { title: "Approve" };

/** The same phone screen as sign in. The component owns its heading. */
export default async function ApprovePage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return (
    <FocusScreen>
      <ApproveScreen requestId={requestId} />
    </FocusScreen>
  );
}
