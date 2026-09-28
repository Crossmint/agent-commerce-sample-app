import type {
  AgentCardRequest,
  AgentCardRequestPatch,
  AgentSession,
  CheckoutLink,
  CheckoutStore,
  ListRevealsOptions,
  NewAgentCardRequest,
  NewReveal,
  RequestStore,
  Reveal,
  RevealStore,
  SessionStore,
} from "../types.js";

/** In-memory request store. For tests and a first `pnpm dev` without a database. */
export function memoryRequestStore(): RequestStore & CheckoutStore & SessionStore & RevealStore {
  const requests = new Map<string, AgentCardRequest>();
  const checkouts = memoryCheckoutStore();
  const sessions = memorySessionStore();
  const reveals = memoryRevealStore();
  return {
    async create(req: NewAgentCardRequest) {
      const now = new Date().toISOString();
      const row: AgentCardRequest = { ...req, createdAt: now, updatedAt: now };
      requests.set(row.id, row);
      return { ...row };
    },
    async get(id: string) {
      const row = requests.get(id);
      return row ? { ...row } : null;
    },
    async update(id: string, patch: AgentCardRequestPatch) {
      const row = requests.get(id);
      if (!row) throw new Error(`Unknown agent card request ${id}`);
      const next: AgentCardRequest = { ...row, ...patch, updatedAt: new Date().toISOString() };
      requests.set(id, next);
      return { ...next };
    },
    async listByUser(userId: string) {
      return [...requests.values()]
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({ ...r }));
    },
    linkCheckout: checkouts.linkCheckout,
    getCheckout: checkouts.getCheckout,
    getSession: sessions.getSession,
    putSession: sessions.putSession,
    recordReveal: reveals.recordReveal,
    listReveals: reveals.listReveals,
  };
}

/** In-memory reveals. Lost on restart, which empties the transactions list. */
export function memoryRevealStore(): RevealStore {
  const rows: Reveal[] = [];
  let seq = 0;
  return {
    async recordReveal(reveal: NewReveal) {
      const row: Reveal = {
        ...reveal,
        id: `rev_${Date.now().toString(36)}${(seq++).toString(36)}`,
        createdAt: new Date().toISOString(),
      };
      // Newest first, so `listReveals` can slice from the front.
      rows.unshift(row);
      return { ...row };
    },
    async listReveals(userId: string, { limit = 100, agentCardId }: ListRevealsOptions = {}) {
      return rows
        .filter((r) => r.userId === userId && (!agentCardId || r.agentCardId === agentCardId))
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
  };
}

/** In-memory exchanged agent sessions. Lost on restart, which forces a new agent login. */
export function memorySessionStore(): SessionStore {
  const sessions = new Map<string, AgentSession>();
  return {
    async getSession(hash) {
      const row = sessions.get(hash);
      return row ? { ...row } : null;
    },
    async putSession(session) {
      sessions.set(session.accessTokenHash, { ...session });
    },
  };
}

/** In-memory checkout → agent card links. Lost on restart. */
export function memoryCheckoutStore(): CheckoutStore {
  const links = new Map<string, CheckoutLink>();
  return {
    async linkCheckout(checkoutId, userId, patch) {
      const existing = links.get(checkoutId);
      links.set(checkoutId, {
        ...(existing ?? { checkoutId, userId, createdAt: new Date().toISOString() }),
        userId,
        // Only overwrite what the caller named, so linking a request later
        // does not drop the card, and vice versa.
        ...(patch?.agentCardId ? { agentCardId: patch.agentCardId } : {}),
        ...(patch?.agentCardRequestId ? { agentCardRequestId: patch.agentCardRequestId } : {}),
        ...(patch?.purpose ? { purpose: patch.purpose } : {}),
      });
    },
    async getCheckout(checkoutId) {
      const row = links.get(checkoutId);
      return row ? { ...row } : null;
    },
  };
}
