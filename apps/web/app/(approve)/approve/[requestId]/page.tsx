import type { Metadata } from "next";
import { ApproveScreen } from "@/components/approve-screen";
import { FocusScreen } from "@/components/focus-screen";

export const metadata: Metadata = { title: "Approve" };

/** The same single column as sign in, in a cell a step wider on a desktop. */
export default async function ApprovePage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return (
    <FocusScreen width="lg">
      <ApproveScreen requestId={requestId} />
    </FocusScreen>
  );
}
