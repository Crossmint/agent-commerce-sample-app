"use client";

import { useState } from "react";
import Link from "next/link";
import { ApproveAgentCard, Button, type ApproveOutcome } from "@goat-wallet/ui";

export function ApproveScreen({ requestId }: { requestId: string }) {
  const [outcome, setOutcome] = useState<ApproveOutcome | null>(null);
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <ApproveAgentCard requestId={requestId} onDone={setOutcome} mascotSrc="/brand/mark.png" />
      {outcome ? (
        <Button asChild variant="outline">
          <Link href="/">Back to wallet</Link>
        </Button>
      ) : null}
    </div>
  );
}
