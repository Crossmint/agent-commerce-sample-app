"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  AddCardDialog,
  AgentCardDetail,
  AgentCardTable,
  Badge,
  Button,
  CardMark,
  EmptyState,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  agentCardGroup,
  cn,
  errorMessage,
  formatAmount,
  formatDateTime,
  formatRelativeTime,
  paymentMethodLabel,
  useAgentCards,
  usePaymentMethods,
  useReveals,
  type AgentCard,
  type AgentCardGroup,
  type UsePaymentMethodsResult,
} from "@agent-commerce/ui";
import { ScreenHeading } from "@/components/focus-screen";

/** The three piles, in the order a user cares about them. */
const PILES: Array<{ group: AgentCardGroup; title: string; description: string }> = [
  { group: "active", title: "Active", description: "Live budgets. An agent can spend from these right now." },
  { group: "needs-verification", title: "Needs verification", description: "Approved, but the card network still wants a word before a number can be minted." },
  { group: "expired", title: "Expired", description: "Lapsed or revoked. Nothing can be spent from these." },
];

/**
 * The Cards section of the desktop app: the cards the user saved, the budgets
 * drawn from them, and every time an agent turned a budget into a card.
 * One scrolling column, each block a heading and the thing itself.
 */
export function CardsSection() {
  const agentCards = useAgentCards();
  // Fetched once here: the saved-cards block lists them, and the tables name
  // the one behind each budget and each reveal.
  const paymentMethods = usePaymentMethods();
  const [adding, setAdding] = useState(false);
  // The budget whose panel is open. Held as the id, so a refetch after a
  // revoke or a verification hands the panel the fresh row.
  const [openId, setOpenId] = useState<string | null>(null);

  const all = agentCards.data;
  const piles = PILES.map((pile) => ({ ...pile, cards: all?.filter((c) => agentCardGroup(c) === pile.group) }));
  // While the list is on its way there is nothing to count, so the first pile
  // carries the skeleton and the others stay out of the way.
  const shown = all ? piles.filter((p) => p.cards!.length > 0) : piles.slice(0, 1);
  const open = all?.find((c) => c.orderIntentId === openId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ScreenHeading title="Cards" sub="Save a card. Agents ask. You approve." />
        <Button type="button" onClick={() => setAdding(true)}>
          <Plus /> Add card
        </Button>
      </div>

      <Block title="Saved cards" description="The cards your budgets are drawn from. The number stays in Crossmint's vault.">
        <SavedCards cards={paymentMethods} onAdd={() => setAdding(true)} />
      </Block>

      {agentCards.error && !all ? (
        <Block title="Agent cards">
          <p className="text-sm text-destructive">{errorMessage(agentCards.error)}</p>
        </Block>
      ) : all && shown.length === 0 ? (
        <Block title="Agent cards" description="Budgets you approved. Revoke any of them at any time.">
          <AgentCardTable agentCards={[]} paymentMethods={paymentMethods.data} />
        </Block>
      ) : (
        shown.map((pile, i) => (
          <Block key={pile.group} title={i === 0 ? `Agent cards · ${pile.title}` : pile.title} description={pile.description}>
            <AgentCardTable
              agentCards={pile.cards}
              paymentMethods={paymentMethods.data}
              loading={agentCards.loading}
              onRevoke={(id) => agentCards.revoke(id)}
              onVerified={async () => {
                await agentCards.refetch();
              }}
              onSelect={(card: AgentCard) => setOpenId(card.orderIntentId)}
            />
          </Block>
        ))
      )}

      <Block title="Transactions" description="Every time an agent turned one of your budgets into a card. The newest is at the top.">
        <Transactions paymentMethods={paymentMethods} />
      </Block>

      <AgentCardDetail
        agentCard={open}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        paymentMethods={paymentMethods.data}
        onRevoke={(id) => agentCards.revoke(id)}
      />

      <AddCardDialog
        open={adding}
        onOpenChange={setAdding}
        onSaved={async () => {
          await paymentMethods.refetch();
        }}
      />
    </div>
  );
}

/** One block of the section: a heading, the line that explains it, and the thing itself. */
function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">{title}</h2>
        {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The cards the user saved. Each row leads with the network's own artwork,
 * which `CardMark` draws from `display.imageUrl`, falling back to the
 * network's short code so the column never comes out empty.
 */
export function SavedCards({ cards, onAdd }: { cards: UsePaymentMethodsResult; onAdd: () => void }) {
  const { data, loading, error, remove } = cards;
  const [busy, setBusy] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    );
  }

  if (error && !data) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;

  if (!data?.length) {
    return (
      <EmptyState
        title="No cards yet"
        description="Save one. Your card number stays in Crossmint's vault."
        action={
          <Button type="button" onClick={onAdd}>
            Add a card
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl bg-card ring-1 ring-foreground/10">
      {data.map((pm) => (
        <li key={pm.paymentMethodId} className="flex items-center gap-4 px-5 py-4">
          <CardMark paymentMethod={pm} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{paymentMethodLabel(pm)}</p>
            {pm.card?.expiration ? (
              <p className="text-xs text-muted-foreground">
                Expires {pm.card.expiration.month}/{pm.card.expiration.year}
              </p>
            ) : null}
          </div>
          {pm.default ? <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">Default</span> : null}
          <Button
            type="button"
            variant="secondary"
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

/** The one column a narrow window cannot fit. */
const WHEN = "hidden sm:table-cell";

/**
 * Every credential an agent minted from a budget, newest first. A reveal is
 * the moment a budget turned into something spendable: Crossmint tells us the
 * card was minted, not what the store later charged. The row holds what was
 * asked for and never what came back.
 */
function Transactions({ paymentMethods }: { paymentMethods: UsePaymentMethodsResult }) {
  const reveals = useReveals();
  const rows = reveals.data;

  if (reveals.error && !rows) return <p className="text-sm text-destructive">{errorMessage(reveals.error)}</p>;
  if (reveals.loading && !rows) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }
  if (!rows?.length) return <EmptyState title="Nothing spent yet" description="When an agent uses one of your budgets, the reveal shows up here." />;

  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>What for</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className={WHEN}>Merchant</TableHead>
            <TableHead>Rail</TableHead>
            <TableHead className={WHEN}>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const pm = paymentMethods.data?.find((p) => p.paymentMethodId === r.paymentMethodId);
            return (
              <TableRow key={r.id}>
                <TableCell className="max-w-[14rem] lg:max-w-[20rem]">
                  <span className="block truncate font-medium">{r.description ?? "Agent card"}</span>
                  {r.requester ? <span className="block truncate text-xs text-muted-foreground">{r.requester}</span> : null}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  <span className="font-display font-semibold">{formatAmount(r.amount.value, r.amount.currency)}</span>
                  {/* A rail that cannot hold the agent to the amount is worth saying out loud. */}
                  {r.enforced === false ? <span className="block text-xs text-warning">not enforced</span> : null}
                </TableCell>
                <TableCell className={cn(WHEN, "max-w-[12rem]")}>
                  <span className="block truncate text-muted-foreground">{r.merchant?.name ?? "—"}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    {pm ? <CardMark paymentMethod={pm} /> : null}
                    <Badge variant="outline">{railLabel(r.rail, r.provider)}</Badge>
                  </span>
                </TableCell>
                <TableCell className={cn(WHEN, "whitespace-nowrap text-muted-foreground")}>
                  <span title={formatDateTime(r.createdAt)}>{formatRelativeTime(r.createdAt)}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** "Mastercard Agent Pay", "Visa IC", "Encrypted card". */
function railLabel(rail: string, provider?: string): string {
  if (rail === "agentic-token") return provider === "vic" ? "Visa IC" : provider === "agentpay" ? "Mastercard Agent Pay" : "Network token";
  if (rail === "encrypted-card") return "Encrypted card";
  if (rail === "spt") return "Stripe SPT";
  return rail;
}
