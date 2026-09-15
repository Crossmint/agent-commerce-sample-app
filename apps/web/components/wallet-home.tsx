"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import {
  AgentCardList,
  Button,
  ConnectedAgents,
  errorMessage,
  useAgentCards,
  type ConnectedAgentSession,
} from "@goat-wallet/ui";
import { SavedCards } from "./saved-cards";

export interface WalletHomeProps {
  sessions: ConnectedAgentSession[];
  sessionsNote?: string;
  revokeSession: (sessionId: string) => Promise<void>;
}

export function WalletHome({ sessions, sessionsNote, revokeSession }: WalletHomeProps) {
  const agentCards = useAgentCards();

  return (
    <div className="flex flex-col gap-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your wallet</h1>
        <p className="text-muted-foreground">Save a card. Agents ask. You approve.</p>
      </div>

      <Section
        title="Saved cards"
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/cards/new">
              <Plus /> Add card
            </Link>
          </Button>
        }
      >
        <SavedCards />
      </Section>

      <Section title="Agent cards" description="Budgets you approved. Revoke any of them at any time.">
        {agentCards.error && !agentCards.data ? (
          <p className="text-sm text-destructive">{errorMessage(agentCards.error)}</p>
        ) : (
          <AgentCardList
            agentCards={agentCards.data}
            loading={agentCards.loading}
            onRevoke={(id) => agentCards.revoke(id)}
            onVerified={async () => {
              await agentCards.refetch();
            }}
          />
        )}
      </Section>

      <Section title="Connected agents" description={sessionsNote ?? "Each CLI or MCP login is a session. Revoke one to log that agent out."}>
        <ConnectedAgents sessions={sessions} onRevoke={revokeSession} />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
