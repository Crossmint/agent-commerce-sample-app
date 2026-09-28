/**
 * Postgres schema and Drizzle store for `@agent-commerce/server`.
 * Import from "@agent-commerce/server/drizzle". Needs `drizzle-orm` installed.
 */
import type { Amount, Merchant } from "@agent-commerce/core";
import { and, desc, eq } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  type PgDatabase,
  type PgQueryResultHKT,
} from "drizzle-orm/pg-core";
import type {
  AgentCardRequest,
  AgentCardRequestPatch,
  AgentCardRequestStatus,
  AgentSession,
  CheckoutLink,
  CheckoutLinkPatch,
  CheckoutStore,
  ListRevealsOptions,
  NewAgentCardRequest,
  NewReveal,
  RequestStore,
  Reveal,
  RevealStore,
  SessionStore,
} from "./types.js";

const tz = { withTimezone: true, mode: "date" } as const;

/** The one table Agent Commerce owns: the agent's ask, until the user answers. */
export const agentCardRequests = pgTable("agent_card_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  requester: text("requester").notNull(),
  amount: jsonb("amount").$type<Amount>().notNull(),
  description: text("description").notNull(),
  merchant: jsonb("merchant").$type<Merchant>(),
  expiresAt: timestamp("expires_at", tz).notNull(),
  requestExpiresAt: timestamp("request_expires_at", tz).notNull(),
  status: text("status").$type<AgentCardRequestStatus>().notNull(),
  agentCardId: text("agent_card_id"),
  paymentMethodId: text("payment_method_id"),
  failureReason: text("failure_reason"),
  approvalUrl: text("approval_url").notNull(),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
});

/** Which agent card pays for a Crossmint checkout. */
export const checkouts = pgTable("checkouts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  // Null until the run has a card: a checkout may start without one and get
  // it at the payment step.
  agentCardId: text("agent_card_id"),
  agentCardRequestId: text("agent_card_request_id"),
  // What the purchase is, in the agent's few words: the agent card's purpose.
  purpose: text("purpose"),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
});

/** Stytch sessions exchanged from agent access tokens. Keyed by token hash. */
export const agentSessions = pgTable("agent_sessions", {
  accessTokenHash: text("access_token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  sessionToken: text("session_token").notNull(),
  jwt: text("jwt").notNull(),
  jwtExpiresAt: timestamp("jwt_expires_at", tz).notNull(),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
});

/**
 * Every credential minted from an agent card: the user's transactions.
 *
 * What was asked for, never what came back — no card number, no network
 * token, no cryptogram. Keep it that way.
 */
export const reveals = pgTable(
  "reveals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    agentCardId: text("agent_card_id").notNull(),
    paymentMethodId: text("payment_method_id"),
    description: text("description"),
    amount: jsonb("amount").$type<Amount>().notNull(),
    merchant: jsonb("merchant").$type<Merchant>(),
    rail: text("rail").notNull(),
    provider: text("provider"),
    enforced: boolean("enforced"),
    requester: text("requester"),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  },
  (t) => [index("reveals_user_id_created_at_idx").on(t.userId, t.createdAt)],
);

export const agentCommerceSchema = { agentCardRequests, checkouts, agentSessions, reveals };

type RequestRow = typeof agentCardRequests.$inferSelect;

/** Any Drizzle Postgres database: node-postgres, postgres.js, Neon, Vercel Postgres. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPgDatabase = PgDatabase<PgQueryResultHKT, any, any>;

/**
 * Request store plus checkout links on Postgres.
 * Create the tables with drizzle-kit from `agentCommerceSchema`, or run the SQL in the README.
 */
export function drizzleRequestStore(
  db: AnyPgDatabase,
): RequestStore & CheckoutStore & SessionStore & RevealStore {
  return {
    async getSession(accessTokenHash: string): Promise<AgentSession | null> {
      const [row] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.accessTokenHash, accessTokenHash))
        .limit(1);
      if (!row) return null;
      return {
        accessTokenHash: row.accessTokenHash,
        userId: row.userId,
        sessionToken: row.sessionToken,
        jwt: row.jwt,
        jwtExpiresAt: row.jwtExpiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    async putSession(session: AgentSession): Promise<void> {
      const values = {
        accessTokenHash: session.accessTokenHash,
        userId: session.userId,
        sessionToken: session.sessionToken,
        jwt: session.jwt,
        jwtExpiresAt: new Date(session.jwtExpiresAt),
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      };
      await db
        .insert(agentSessions)
        .values(values)
        .onConflictDoUpdate({
          target: agentSessions.accessTokenHash,
          set: {
            jwt: values.jwt,
            jwtExpiresAt: values.jwtExpiresAt,
            sessionToken: values.sessionToken,
            updatedAt: values.updatedAt,
          },
        });
    },

    async create(req: NewAgentCardRequest): Promise<AgentCardRequest> {
      const now = new Date();
      const [row] = await db
        .insert(agentCardRequests)
        .values({
          id: req.id,
          userId: req.userId,
          requester: req.requester,
          amount: req.amount,
          description: req.description,
          merchant: req.merchant ?? null,
          expiresAt: new Date(req.expiresAt),
          requestExpiresAt: new Date(req.requestExpiresAt),
          status: req.status,
          agentCardId: req.agentCardId ?? null,
          paymentMethodId: req.paymentMethodId ?? null,
          failureReason: req.failureReason ?? null,
          approvalUrl: req.approvalUrl,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return toRequest(row!);
    },

    async get(id: string): Promise<AgentCardRequest | null> {
      const [row] = await db
        .select()
        .from(agentCardRequests)
        .where(eq(agentCardRequests.id, id))
        .limit(1);
      return row ? toRequest(row) : null;
    },

    async update(id: string, patch: AgentCardRequestPatch): Promise<AgentCardRequest> {
      const set: Partial<typeof agentCardRequests.$inferInsert> = { updatedAt: new Date() };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.agentCardId !== undefined) set.agentCardId = patch.agentCardId;
      if (patch.paymentMethodId !== undefined) set.paymentMethodId = patch.paymentMethodId;
      if (patch.failureReason !== undefined) set.failureReason = patch.failureReason;
      const [row] = await db
        .update(agentCardRequests)
        .set(set)
        .where(eq(agentCardRequests.id, id))
        .returning();
      if (!row) throw new Error(`Unknown agent card request ${id}`);
      return toRequest(row);
    },

    async listByUser(userId: string): Promise<AgentCardRequest[]> {
      const rows = await db
        .select()
        .from(agentCardRequests)
        .where(eq(agentCardRequests.userId, userId))
        .orderBy(desc(agentCardRequests.createdAt));
      return rows.map(toRequest);
    },

    async linkCheckout(
      checkoutId: string,
      userId: string,
      patch?: CheckoutLinkPatch,
    ): Promise<void> {
      // Only the named columns are written, so linking a request later does
      // not drop the card, and vice versa.
      const set = {
        userId,
        ...(patch?.agentCardId ? { agentCardId: patch.agentCardId } : {}),
        ...(patch?.agentCardRequestId ? { agentCardRequestId: patch.agentCardRequestId } : {}),
        ...(patch?.purpose ? { purpose: patch.purpose } : {}),
      };
      await db
        .insert(checkouts)
        .values({ id: checkoutId, ...set })
        .onConflictDoUpdate({ target: checkouts.id, set });
    },

    async recordReveal(reveal: NewReveal): Promise<Reveal> {
      const [row] = await db
        .insert(reveals)
        .values({
          // Sortable by time, and unique without another round trip.
          id: `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
          userId: reveal.userId,
          agentCardId: reveal.agentCardId,
          paymentMethodId: reveal.paymentMethodId ?? null,
          description: reveal.description ?? null,
          amount: reveal.amount,
          merchant: reveal.merchant ?? null,
          rail: reveal.rail,
          provider: reveal.provider ?? null,
          enforced: reveal.enforced ?? null,
          requester: reveal.requester ?? null,
          createdAt: new Date(),
        })
        .returning();
      return toReveal(row!);
    },

    async listReveals(
      userId: string,
      { limit = 100, agentCardId }: ListRevealsOptions = {},
    ): Promise<Reveal[]> {
      const rows = await db
        .select()
        .from(reveals)
        .where(
          agentCardId
            ? and(eq(reveals.userId, userId), eq(reveals.agentCardId, agentCardId))
            : eq(reveals.userId, userId),
        )
        .orderBy(desc(reveals.createdAt))
        .limit(limit);
      return rows.map(toReveal);
    },

    async getCheckout(checkoutId: string): Promise<CheckoutLink | null> {
      const [row] = await db.select().from(checkouts).where(eq(checkouts.id, checkoutId)).limit(1);
      if (!row) return null;
      return {
        checkoutId: row.id,
        userId: row.userId,
        ...(row.agentCardId ? { agentCardId: row.agentCardId } : {}),
        ...(row.agentCardRequestId ? { agentCardRequestId: row.agentCardRequestId } : {}),
        ...(row.purpose ? { purpose: row.purpose } : {}),
        createdAt: row.createdAt.toISOString(),
      };
    },
  };
}

function toReveal(row: typeof reveals.$inferSelect): Reveal {
  const out: Reveal = {
    id: row.id,
    userId: row.userId,
    agentCardId: row.agentCardId,
    amount: row.amount,
    rail: row.rail,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.paymentMethodId) out.paymentMethodId = row.paymentMethodId;
  if (row.description) out.description = row.description;
  if (row.merchant) out.merchant = row.merchant;
  if (row.provider) out.provider = row.provider;
  if (row.enforced !== null) out.enforced = row.enforced;
  if (row.requester) out.requester = row.requester;
  return out;
}

function toRequest(row: RequestRow): AgentCardRequest {
  const out: AgentCardRequest = {
    id: row.id,
    userId: row.userId,
    requester: row.requester,
    amount: row.amount,
    description: row.description,
    expiresAt: row.expiresAt.toISOString(),
    requestExpiresAt: row.requestExpiresAt.toISOString(),
    status: row.status,
    approvalUrl: row.approvalUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.merchant) out.merchant = row.merchant;
  if (row.agentCardId) out.agentCardId = row.agentCardId;
  if (row.paymentMethodId) out.paymentMethodId = row.paymentMethodId;
  if (row.failureReason) out.failureReason = row.failureReason;
  return out;
}
