import { describe, expect, it } from 'vitest';
import { fetchVersion } from './api';

const respond = (body: unknown, init?: ResponseInit) =>
  (async () => new Response(JSON.stringify(body), init)) as unknown as typeof fetch;

describe('fetchVersion', () => {
  it('returns a short value unchanged', async () => {
    expect(await fetchVersion(respond({ version: 'dev' }))).toBe('dev');
  });

  it('shortens a full commit sha to 7 characters', async () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    expect(await fetchVersion(respond({ version: sha }))).toBe('0123456');
  });

  it('returns null on a network error', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchVersion(failing)).toBeNull();
  });

  it('returns null on a non-2xx status', async () => {
    expect(await fetchVersion(respond({ version: 'abc' }, { status: 500 }))).toBeNull();
  });

  it('returns null when the body has no string version', async () => {
    expect(await fetchVersion(respond({}))).toBeNull();
    expect(await fetchVersion(respond({ version: 42 }))).toBeNull();
  });
});
