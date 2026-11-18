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
