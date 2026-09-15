"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, Button } from "@goat-wallet/ui";
import type { CheckoutView } from "@goat-wallet/server";
import { ToolCard, type ToolState } from "./tool-card";

/**
 * A checkout as a card: status, what Crossmint needs next, a link to the
 * wallet's checkout page where the user can watch it and answer actions.
 */
export function CheckoutCard({
  title,
  state,
  input,
  checkout,
  errorText,
}: {
  title: string;
  state: ToolState;
  input?: unknown;
  checkout?: CheckoutView | { error: string; code: string };
  errorText?: string;
}) {
  const failed = checkout && "error" in checkout ? checkout : undefined;
  const view = checkout && !("error" in checkout) ? checkout : undefined;

  return (
    <ToolCard
      title={title}
      state={state}
      input={input}
      output={checkout}
      errorText={errorText ?? failed?.error}
      summary={view ? <StatusLine view={view} /> : undefined}
    >
      {view ? (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Checkout</dt>
            <dd className="truncate font-mono">{view.id}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={badgeVariant(view.status)}>{view.status.replace(/_/g, " ")}</Badge>
            </dd>
            {view.rendered ? (
              <>
                <dt className="text-muted-foreground">Needs</dt>
                <dd>{view.rendered.title}</dd>
              </>
            ) : null}
            {view.failure ? (
              <>
                <dt className="text-muted-foreground">Failure</dt>
                <dd className="text-destructive">{view.failure.message ?? view.failure.reason}</dd>
              </>
            ) : null}
          </dl>
          <Button asChild size="sm" variant="outline" className="self-start">
            <Link href={`/checkouts/${encodeURIComponent(view.id)}`}>
              Open checkout <ArrowUpRight />
            </Link>
          </Button>
        </div>
      ) : null}
    </ToolCard>
  );
}

function StatusLine({ view }: { view: CheckoutView }) {
  if (view.failure) return <>Failed: {view.failure.message ?? view.failure.reason}</>;
  if (view.rendered) return <>Waiting for input: {view.rendered.title}</>;
  return <>{view.status.replace(/_/g, " ")}</>;
}

function badgeVariant(status: string): "success" | "warning" | "destructive" | "muted" {
  const s = status.toLowerCase();
  if (s.includes("complete") || s.includes("success") || s.includes("purchased")) return "success";
  if (s.includes("fail") || s.includes("cancel") || s.includes("error")) return "destructive";
  if (s.includes("pending") || s.includes("action") || s.includes("progress")) return "warning";
  return "muted";
}
