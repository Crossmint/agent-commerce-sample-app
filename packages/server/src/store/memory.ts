import type {
  AgentCardRequest,
  AgentCardRequestPatch,
  AgentSession,
  CheckoutLink,
  CheckoutStore,
  NewAgentCardRequest,
  RequestStore,
  SessionStore,
} from "../types.js";

/** In-memory request store. For tests and a first `pnpm dev` without a database. */
export function memoryRequestStore(): RequestStore & CheckoutStore & SessionStore {
  const requests = new Map<string, AgentCardRequest>();
  const checkouts = memoryCheckoutStore();
  const sessions = memorySessionStore();
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
    async linkCheckout(checkoutId, userId, agentCardId) {
      links.set(checkoutId, {
        checkoutId,
        userId,
        agentCardId,
        createdAt: new Date().toISOString(),
      });
    },
    async getCheckout(checkoutId) {
      const row = links.get(checkoutId);
      return row ? { ...row } : null;
    },
  };
}
