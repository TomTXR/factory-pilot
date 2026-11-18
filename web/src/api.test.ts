import { describe, expect, it } from 'vitest';
import { fetchVersion } from './api';

const respond = (body: unknown, init?: ResponseInit) =>
  (async () => new Response(JSON.stringify(body), init)) as unknown as typeof fetch;

describe('fetchVersion', () => {
  it('returns the semantic version unchanged', async () => {
    expect(await fetchVersion(respond({ version: '1.2.3' }))).toBe('1.2.3');
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
