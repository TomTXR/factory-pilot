import { describe, expect, it } from 'vitest';
import { createAddressApi, createPropertiesApi, fetchMe, fetchSignInMode, fetchVersion } from './api';

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

describe('auth calls', () => {
  it('fetchMe returns null on 401 and the user on 200', async () => {
    expect(await fetchMe(respond({ error: 'x' }, { status: 401 }))).toBeNull();
    const user = { id: 'u', email: 'a@b.c', name: 'A' };
    expect(await fetchMe(respond(user))).toEqual(user);
  });

  it('fetchMe throws on a server error', async () => {
    await expect(fetchMe(respond({}, { status: 500 }))).rejects.toThrow();
  });

  it('fetchSignInMode defaults to test unless the API says google', async () => {
    expect(await fetchSignInMode(respond({ mode: 'google' }))).toBe('google');
    expect(await fetchSignInMode(respond({ mode: 'test' }))).toBe('test');
  });

  it('createPropertiesApi turns a 401 into an unauthorized ApiError', async () => {
    const api = createPropertiesApi(respond({ error: 'Not signed in' }, { status: 401 }));
    await expect(api.list()).rejects.toMatchObject({ status: 401, unauthorized: true });
  });
});

describe('createAddressApi', () => {
  it('suggests through our own API with encoded text', async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ status: 'ok', suggestions: [] }));
    }) as unknown as typeof fetch;
    expect(await createAddressApi(fetchFn).suggest('a & b 1')).toEqual({ status: 'ok', suggestions: [] });
    expect(calls).toEqual(['/api/address/suggest?q=a+%26+b+1']);
  });

  it('answers unavailable for a network error or a server error', async () => {
    const down = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect(await createAddressApi(down).suggest('abc')).toEqual({ status: 'unavailable' });
    expect(await createAddressApi(down).lookupById('adr-1')).toEqual({ status: 'unavailable' });
    const broken = respond({ error: 'x' }, { status: 500 });
    expect(await createAddressApi(broken).refresh({ postalCode: '9999 SS', houseNumber: '1', addition: '' })).toEqual({
      status: 'unavailable',
    });
  });

  it('throws a field error for a refresh the API rejects', async () => {
    const bad = respond({ errors: { postalCode: 'x' } }, { status: 400 });
    await expect(createAddressApi(bad).refresh({ postalCode: '1', houseNumber: '1', addition: '' })).rejects.toMatchObject({
      status: 400,
    });
  });
});
