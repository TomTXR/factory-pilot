import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Parallel stories must not share a counter: two branches would both create the next
// number and git would report nothing (AGENTS.md, "Parallel work"). New migrations are
// named by their UTC creation time. The runner applies files sorted by name and records
// applied names, so the numbered files from before this rule stay first and unchanged.
const LEGACY = ['001_init.sql', '002_properties.sql', '003_users_sessions.sql', '004_property_accounts.sql'];
const NAME = /^\d{8}T\d{4}_[a-z0-9_]+\.sql$/;

describe('migration file names', () => {
  const files = readdirSync(join(import.meta.dirname, '..', 'migrations')).filter((f) => f.endsWith('.sql'));

  it('names every new migration YYYYMMDDTHHMM_name.sql (UTC)', () => {
    const bad = files.filter((f) => !LEGACY.includes(f) && !NAME.test(f));
    expect(bad, 'rename to YYYYMMDDTHHMM_name.sql, for example 20261120T0815_add_items.sql').toEqual([]);
  });

  it('sorts the numbered migrations before all named ones', () => {
    const sorted = [...files].sort();
    expect(sorted.slice(0, LEGACY.length)).toEqual(LEGACY);
  });
});
