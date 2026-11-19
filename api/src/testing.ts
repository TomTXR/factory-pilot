import { type AuthDeps, type AuthMode, type GoogleClient, SESSION_TTL_MS, type SessionStore, type User, type UserStore } from './auth.js';
import { normaliseKey, type Property, type PropertyRepository } from './properties.js';

/** In-memory repository for route tests. Enforces the same uniqueness rule as the database index. */
export function memoryRepository(): PropertyRepository {
  const rows = new Map<string, Property>();
  let seq = 0;
  const taken = (key: string, exceptId?: string) =>
    [...rows.values()].some((p) => p.id !== exceptId && normaliseKey(p) === key);

  return {
    async list() {
      return [...rows.values()];
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async create(input) {
      if (taken(normaliseKey(input))) return 'duplicate';
      seq += 1;
      const now = new Date(2026, 0, seq).toISOString();
      const id = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
      const property = { ...input, id, createdAt: now, updatedAt: now };
      rows.set(id, property);
      return property;
    },
    async update(id, input) {
      const existing = rows.get(id);
      if (!existing) return null;
      if (taken(normaliseKey(input), id)) return 'duplicate';
      const property = { ...existing, ...input, updatedAt: new Date().toISOString() };
      rows.set(id, property);
      return property;
    },
    async remove(id) {
      return rows.delete(id);
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
