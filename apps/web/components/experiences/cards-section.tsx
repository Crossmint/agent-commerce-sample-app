"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  AddCardDialog,
  AgentCardDetail,
  AgentCardTable,
  Button,
  CardMark,
  EmptyState,
  Skeleton,
  Spinner,
  agentCardGroup,
  errorMessage,
  paymentMethodLabel,
  useAgentCards,
  usePaymentMethods,
  type AgentCard,
  type AgentCardGroup,
  type UsePaymentMethodsResult,
} from "@agent-commerce/ui";
import { ScreenHeading } from "@/components/focus-screen";

/** The piles, in the order a user cares about them. */
const PILES: Array<{ group: AgentCardGroup; title: string; description: string }> = [
  { group: "active", title: "Active", description: "Live budgets. An agent can spend from these right now." },
  { group: "needs-verification", title: "Needs verification", description: "Approved, but the card network still wants a word before a number can be minted." },
  { group: "needs-cvc", title: "Needs security code", description: "Crossmint's copy of the card's security code lapsed. Enter it again from the row's menu." },
  { group: "expired", title: "Expired", description: "Lapsed or revoked. Nothing can be spent from these." },
];

/**
 * The Cards section of the desktop app: the cards the user saved and the
 * budgets drawn from them, in one scrolling column, each block a heading and
 * the thing itself.
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
              // One saved card can back several budgets, so the whole list is
              // read again rather than this one row.
              onCvcRecollected={async () => {
                await agentCards.refetch();
              }}
              onSelect={(card: AgentCard) => setOpenId(card.orderIntentId)}
            />
          </Block>
        ))
      )}

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
