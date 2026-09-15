"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, SaveCard, type SaveCardResult } from "@goat-wallet/ui";

export function NewCard() {
  const [saved, setSaved] = useState<SaveCardResult | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <div className="goat-window p-0">
        <div className="p-5">
          <SaveCard onSaved={setSaved} />
        </div>
      </div>
      {saved ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/">Back to wallet</Link>
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => setSaved(null)}>
            Add another
          </Button>
        </div>
      ) : null}
    </div>
  );
}
