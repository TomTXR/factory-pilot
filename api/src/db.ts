import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';
import { logger } from './logger.js';

export type Sql = postgres.Sql;

export function connect(databaseUrl: string): Sql {
  return postgres(databaseUrl, { max: 5, onnotice: () => undefined });
}

export async function checkDb(sql: Sql): Promise<boolean> {
  const rows = await sql`select 1 as ok`;
  return rows[0]?.ok === 1;
}

/**
 * Applies SQL files from the migrations directory in name order.
 * Each file runs once, inside a transaction, and is recorded in schema_migrations.
 */
export async function migrate(sql: Sql, dir: string): Promise<void> {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name as string));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(join(dir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    logger.info('migration applied', { file });
  }
}
