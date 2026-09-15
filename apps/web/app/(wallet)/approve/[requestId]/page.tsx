import type { Metadata } from "next";
import { ApproveScreen } from "@/components/approve-screen";

export const metadata: Metadata = { title: "Approve" };

export default async function ApprovePage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return (
    <div className="goat-backdrop -mx-4 -my-10 flex flex-1 items-center justify-center px-4 py-12 sm:-mx-6 sm:px-6">
      <ApproveScreen requestId={requestId} />
    </div>
  );
}
