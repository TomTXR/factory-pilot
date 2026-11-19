import type { Sql } from './db.js';
import type { SessionStore, User, UserStore } from './auth.js';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
}

const toUser = (r: UserRow): User => ({ id: r.id, email: r.email, name: r.display_name });

export function createUserStore(sql: Sql): UserStore {
  return {
    async signIn(identity) {
      const rows = await sql<UserRow[]>`
        insert into users (google_sub, email, display_name)
        values (${identity.sub}, ${identity.email}, ${identity.name})
        on conflict (google_sub) do update
          set email = excluded.email, display_name = excluded.display_name, last_login_at = now()
        returning id, email, display_name`;
      return toUser(rows[0] as UserRow);
    },
    async deleteAccount(userId) {
      // Properties are deleted explicitly: the foreign key has no cascade on purpose, so a deletion
      // of a user anywhere else still fails. Sessions go through their on delete cascade.
      return sql.begin(async (tx) => {
        const properties = await tx`delete from properties where account_user_id = ${userId} returning id`;
        await tx`delete from users where id = ${userId}`;
        return properties.length;
      });
    },
  };
}

export function createSessionStore(sql: Sql): SessionStore {
  return {
    async create(userId, tokenHash, expiresAt) {
      await sql`insert into sessions (user_id, token_hash, expires_at) values (${userId}, ${tokenHash}, ${expiresAt})`;
    },
    async find(tokenHash, now, ttlMs, refreshAfterMs) {
      const rows = await sql<(UserRow & { last_used_at: Date })[]>`
        select u.id, u.email, u.display_name, s.last_used_at
        from sessions s join users u on u.id = s.user_id
        where s.token_hash = ${tokenHash} and s.expires_at > ${now}`;
      const row = rows[0];
      if (!row) return null;
      const refreshed = now.getTime() - row.last_used_at.getTime() >= refreshAfterMs;
      if (refreshed) {
        await sql`update sessions set last_used_at = ${now}, expires_at = ${new Date(now.getTime() + ttlMs)}
                  where token_hash = ${tokenHash}`;
      }
      return { user: toUser(row), refreshed };
    },
    async remove(tokenHash) {
      await sql`delete from sessions where token_hash = ${tokenHash}`;
    },
    async purgeExpired(now) {
      await sql`delete from sessions where expires_at <= ${now}`;
    },
  };
}
