import { type AuthDeps, type AuthMode, type GoogleClient, SESSION_TTL_MS, type SessionStore, type User, type UserStore } from './auth.js';
import { normaliseKey, type Property, type PropertyInput, type PropertyRepository } from './properties.js';

/** In-memory repository for route tests. Enforces the same per-account rules as the database. */
export function memoryRepository(): PropertyRepository & { seedUnowned: (input: PropertyInput) => void } {
  const rows = new Map<string, Property & { account: string | null }>();
  let seq = 0;
  let claimed = false;
  const strip = (row: Property & { account: string | null }): Property => {
    const { account, ...property } = row;
    void account;
    return property;
  };
  const taken = (userId: string, key: string, exceptId?: string) =>
    [...rows.values()].some((p) => p.id !== exceptId && p.account === userId && normaliseKey(p) === key);
  const own = (userId: string, id: string) => {
    const row = rows.get(id);
    return row && row.account === userId ? row : undefined;
  };

  return {
    async list(userId) {
      return [...rows.values()].filter((p) => p.account === userId).map(strip);
    },
    async get(userId, id) {
      const row = own(userId, id);
      return row ? strip(row) : null;
    },
    async create(userId, input) {
      if (taken(userId, normaliseKey(input))) return 'duplicate';
      seq += 1;
      const now = new Date(2026, 0, seq).toISOString();
      const id = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
      const row = { ...input, id, createdAt: now, updatedAt: now, account: userId };
      rows.set(id, row);
      return strip(row);
    },
    async update(userId, id, input) {
      const existing = own(userId, id);
      if (!existing) return null;
      if (taken(userId, normaliseKey(input), id)) return 'duplicate';
      const row = { ...existing, ...input, updatedAt: new Date().toISOString() };
      rows.set(id, row);
      return strip(row);
    },
    async remove(userId, id) {
      return own(userId, id) ? rows.delete(id) : false;
    },
    async claimUnowned(userId) {
      if (claimed) return 0;
      claimed = true;
      let count = 0;
      for (const row of rows.values()) {
        // Same rule as the database: a row the account already has an identical one of stays unowned.
        if (row.account === null && !taken(userId, normaliseKey(row))) {
          row.account = userId;
          count += 1;
        }
      }
      return count;
    },
    /** Test helper: a property created before accounts existed. */
    seedUnowned(input) {
      seq += 1;
      const now = new Date(2026, 0, seq).toISOString();
      const id = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
      rows.set(id, { ...input, id, createdAt: now, updatedAt: now, account: null });
    },
  };
}

export interface MemoryAuth {
  users: UserStore;
  sessions: SessionStore;
  userCount: () => number;
  sessionCount: () => number;
}

/** In-memory user and session stores for route tests. */
export function memoryAuth(): MemoryAuth {
  const users = new Map<string, User & { sub: string }>();
  const sessions = new Map<string, { userId: string; lastUsed: Date; expiresAt: Date }>();
  return {
    userCount: () => users.size,
    sessionCount: () => sessions.size,
    users: {
      async signIn(identity) {
        const existing = [...users.values()].find((u) => u.sub === identity.sub);
        const user = {
          id: existing?.id ?? `u${users.size + 1}`,
          sub: identity.sub,
          email: identity.email,
          name: identity.name,
        };
        users.set(user.id, user);
        return { id: user.id, email: user.email, name: user.name };
      },
    },
    sessions: {
      async create(userId, tokenHash, expiresAt) {
        sessions.set(tokenHash, { userId, lastUsed: new Date(expiresAt.getTime() - SESSION_TTL_MS), expiresAt });
      },
      async find(tokenHash, now, ttlMs, refreshAfterMs) {
        const s = sessions.get(tokenHash);
        const u = s && users.get(s.userId);
        if (!s || !u || s.expiresAt <= now) return null;
        const refreshed = now.getTime() - s.lastUsed.getTime() >= refreshAfterMs;
        if (refreshed) {
          s.lastUsed = now;
          s.expiresAt = new Date(now.getTime() + ttlMs);
        }
        return { user: { id: u.id, email: u.email, name: u.name }, refreshed };
      },
      async remove(tokenHash) {
        sessions.delete(tokenHash);
      },
      async purgeExpired(now) {
        for (const [k, s] of sessions) if (s.expiresAt <= now) sessions.delete(k);
      },
    },
  };
}

/** Auth dependencies for route tests: in-memory stores and, in google mode, a stubbed Google. */
export function testAuth(mode: AuthMode = 'test', google?: GoogleClient): AuthDeps & MemoryAuth {
  const stores = memoryAuth();
  return { ...stores, mode, google };
}
