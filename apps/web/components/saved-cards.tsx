"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import {
  Button,
  EmptyState,
  Skeleton,
  Spinner,
  errorMessage,
  paymentMethodLabel,
  usePaymentMethods,
} from "@goat-wallet/ui";

export function SavedCards() {
  const { data, loading, error, remove } = usePaymentMethods();
  const [busy, setBusy] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (error && !data) {
    return <p className="text-sm text-destructive">{errorMessage(error)}</p>;
  }

  if (!data?.length) {
    return (
      <EmptyState
        title="No cards yet"
        description="Save one. Your card number stays in Crossmint's vault."
        action={
          <Button asChild>
            <Link href="/cards/new">Add a card</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
      {data.map((pm) => (
        <li key={pm.paymentMethodId} className="flex items-center gap-4 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CreditCard className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{paymentMethodLabel(pm)}</p>
            {pm.card?.expiration ? (
              <p className="text-xs text-muted-foreground">
                Expires {pm.card.expiration.month}/{pm.card.expiration.year}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy === pm.paymentMethodId}
            onClick={async () => {
              if (!window.confirm(`Remove ${paymentMethodLabel(pm)}?`)) return;
              setBusy(pm.paymentMethodId);
              try {
                await remove(pm.paymentMethodId);
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === pm.paymentMethodId ? <Spinner /> : null}
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}
