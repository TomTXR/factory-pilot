import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AddressClient,
  additionKey,
  chooseAddress,
  formatAddition,
  normaliseHouseNumber,
  normalisePostalCode,
} from './addressClient.js';
import { createStubAddressClient, STUB_ADDRESSES } from './addressStub.js';
import { createApp } from './app.js';
import { createPdokClient, toAddress } from './pdokClient.js';
import { memoryRepository, testAuth } from './testing.js';

const ID = `adr-${'0'.repeat(31)}1`;

// Synthetic PDOK-shaped documents (invented street, postal code letters SS are never issued).
const doc = (over: Record<string, unknown> = {}) => ({
  straatnaam: 'Voorbeeldstraat',
  huisnummer: 14,
  huisletter: 'A',
  huisnummertoevoeging: '2',
  postcode: '9999SS',
  woonplaatsnaam: 'Testdorp',
  ...over,
});

const reply = (docs: unknown[], status = 200) =>
  new Response(JSON.stringify({ response: { docs } }), { status, headers: { 'content-type': 'application/json' } });

describe('input normalisation', () => {
  it('accepts postal codes in any case with or without a space', () => {
    expect(normalisePostalCode('1234ab')).toBe('1234 AB');
    expect(normalisePostalCode(' 1234 Ab ')).toBe('1234 AB');
    expect(normalisePostalCode('0123 AB')).toBeNull();
    expect(normalisePostalCode('12345 AB')).toBeNull();
    expect(normalisePostalCode('1234 A')).toBeNull();
  });

  it('accepts house numbers from 1 to 99999', () => {
    expect(normaliseHouseNumber('12')).toBe('12');
    expect(normaliseHouseNumber('007')).toBe('7');
    expect(normaliseHouseNumber('0')).toBeNull();
    expect(normaliseHouseNumber('100000')).toBeNull();
    expect(normaliseHouseNumber('12a')).toBeNull();
    expect(normaliseHouseNumber('-1')).toBeNull();
  });
});

describe('addition mapping', () => {
  it('formats letter, addition and both', () => {
    expect(formatAddition('A', undefined)).toBe('A');
    expect(formatAddition(undefined, '2')).toBe('2');
    expect(formatAddition('A', '2')).toBe('A-2');
    expect(formatAddition('', '')).toBe('');
  });

  it('compares ignoring case, spaces and dashes', () => {
    expect(additionKey('A-2')).toBe(additionKey('a 2'));
    expect(additionKey('A-2')).toBe(additionKey('A2'));
    expect(additionKey('A')).not.toBe(additionKey('A-2'));
  });

  it('maps a PDOK document and rejects incomplete ones', () => {
    expect(toAddress(doc())).toEqual({
      street: 'Voorbeeldstraat',
      houseNumber: '14',
      houseNumberAddition: 'A-2',
      postalCode: '9999 SS',
      city: 'Testdorp',
    });
    expect(toAddress(doc({ huisletter: undefined, huisnummertoevoeging: undefined }))?.houseNumberAddition).toBe('');
    expect(toAddress(doc({ woonplaatsnaam: undefined }))).toBeNull();
    expect(toAddress(doc({ postcode: 'nonsense' }))).toBeNull();
  });
});

describe('chooseAddress', () => {
  const a = (addition: string) => ({ ...(toAddress(doc({ huisletter: '', huisnummertoevoeging: '' })) as object), houseNumberAddition: addition }) as never;
  it('finds the only address without an addition', () => {
    expect(chooseAddress([a('')], '').status).toBe('found');
  });
  it('finds the address that matches the addition', () => {
    expect(chooseAddress([a('A'), a('1')], 'a').status).toBe('found');
  });
  it('lists additions when several match or none does', () => {
    expect(chooseAddress([a('A'), a('1'), a('A-2')], '')).toEqual({ status: 'several', additions: ['1', 'A', 'A-2'] });
    expect(chooseAddress([a('A'), a('1')], 'Z')).toEqual({ status: 'several', additions: ['1', 'A'] });
  });
  it('reports not found without candidates or additions to offer', () => {
    expect(chooseAddress([], '')).toEqual({ status: 'not_found' });
    expect(chooseAddress([a('')], 'B')).toEqual({ status: 'not_found' });
  });
});

describe('PDOK client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('suggests with a fixed host, encoded text and the address filter', async () => {
    const fetchFn = vi.fn(async () => reply([{ id: ID, weergavenaam: 'Voorbeeldstraat 14A, 9999 SS Testdorp', type: 'adres' }, { id: '', weergavenaam: 'x' }]));
    const result = await createPdokClient(fetchFn as unknown as typeof fetch).suggest('voorbeeld & 14');
    expect(result).toEqual({ status: 'ok', suggestions: [{ id: ID, label: 'Voorbeeldstraat 14A, 9999 SS Testdorp' }] });
    const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
    expect(url.origin).toBe('https://api.pdok.nl');
    expect(url.searchParams.get('q')).toBe('voorbeeld & 14');
    expect(url.searchParams.get('fq')).toBe('type:adres');
    expect(url.searchParams.get('rows')).toBe('8');
  });

  it('looks up an id', async () => {
    const client = createPdokClient((async () => reply([doc()])) as unknown as typeof fetch);
    expect(await client.lookupById(ID)).toMatchObject({ status: 'found', address: { postalCode: '9999 SS', houseNumberAddition: 'A-2' } });
    const empty = createPdokClient((async () => reply([])) as unknown as typeof fetch);
    expect(await empty.lookupById(ID)).toEqual({ status: 'not_found' });
  });

  it('looks up by postal code, filtering on the house number', async () => {
    const fetchFn = vi.fn(async () => reply([doc({ huisletter: 'A', huisnummertoevoeging: '' }), doc({ huisletter: '', huisnummertoevoeging: '1' }), doc({ huisnummer: 16 })]));
    const client = createPdokClient(fetchFn as unknown as typeof fetch);
    const result = await client.lookupByPostalCode({ postalCode: '9999 ss', houseNumber: '14', addition: '' });
    expect(result).toEqual({ status: 'several', additions: ['1', 'A'] });
    const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('q')).toBe('postcode:9999SS');
    expect(url.searchParams.getAll('fq')).toContain('huisnummer:14');
    expect(await client.lookupByPostalCode({ postalCode: '9999 SS', houseNumber: '14', addition: 'a' })).toMatchObject({
      status: 'found',
      address: { houseNumberAddition: 'A' },
    });
  });

  it('answers unavailable for an HTTP error, a bad body, a network error and a timeout', async () => {
    const make = (fn: () => Promise<Response>) => createPdokClient(fn as unknown as typeof fetch);
    const failures = [
      make(async () => reply([], 503)),
      make(async () => new Response('not json')),
      make(async () => {
        throw new TypeError('network');
      }),
      make(async () => {
        throw new DOMException('timed out', 'TimeoutError');
      }),
    ];
    for (const c of failures) {
      expect(await c.suggest('abc')).toEqual({ status: 'unavailable' });
      expect(await c.lookupById(ID)).toEqual({ status: 'unavailable' });
      expect(await c.lookupByPostalCode({ postalCode: '9999 SS', houseNumber: '1', addition: '' })).toEqual({ status: 'unavailable' });
    }
  });

  it('passes a 5 second timeout signal', async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return reply([]);
    });
    await createPdokClient(fetchFn as unknown as typeof fetch).suggest('abc');
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

describe('stub client', () => {
  const stub = createStubAddressClient();
  it('uses only synthetic postal codes', () => {
    for (const a of STUB_ADDRESSES) expect(a.postalCode).toMatch(/^99\d\d S[ADS]$/);
  });
  it('suggests, looks up and refreshes', async () => {
    const s = await stub.suggest('9999 SS 14');
    expect(s.status === 'ok' && s.suggestions.length).toBe(3);
    if (s.status !== 'ok') throw new Error('unexpected');
    const first = s.suggestions[0];
    expect((await stub.lookupById((first as { id: string }).id)).status).toBe('found');
    expect(await stub.lookupByPostalCode({ postalCode: '9999SS', houseNumber: '14', addition: '' })).toMatchObject({ status: 'several' });
    expect(await stub.lookupByPostalCode({ postalCode: '1011 AB', houseNumber: '7', addition: '' })).toEqual({ status: 'not_found' });
  });
  it('answers unavailable for the failure postal code', async () => {
    expect(await stub.suggest('9990 SD')).toEqual({ status: 'unavailable' });
    expect(await stub.lookupByPostalCode({ postalCode: '9990 SD', houseNumber: '1', addition: '' })).toEqual({ status: 'unavailable' });
  });
});

function build(address: AddressClient = createStubAddressClient()) {
  const app = createApp({ checkDb: async () => true, properties: memoryRepository(), version: 't', auth: testAuth(), address });
  const login = Promise.resolve(app.request('/api/auth/test-login', { method: 'POST' })).then(
    (r) => (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '',
  );
  return { get: async (path: string) => app.request(`/api/address/${path}`, { headers: { cookie: await login } }), app };
}

function spyClient(): AddressClient & { calls: number } {
  const c = {
    calls: 0,
    suggest: async () => (c.calls++, { status: 'ok' as const, suggestions: [] }),
    lookupById: async () => (c.calls++, { status: 'not_found' as const }),
    lookupByPostalCode: async () => (c.calls++, { status: 'not_found' as const }),
  };
  return c;
}

describe('address routes', () => {
  it('answers 401 without a session', async () => {
    const { app } = build();
    for (const path of ['suggest?q=abc', `lookup?id=${ID}`, 'lookup?postalCode=9999SS&houseNumber=1']) {
      expect((await app.request(`/api/address/${path}`)).status).toBe(401);
    }
  });

  it('answers 400 without calling the client for invalid input', async () => {
    const client = spyClient();
    const { get } = build(client);
    for (const path of [
      'suggest?q=ab',
      'suggest',
      `suggest?q=${'x'.repeat(101)}`,
      'lookup?id=nonsense',
      'lookup?id=',
      'lookup?postalCode=12&houseNumber=1',
      'lookup?postalCode=9999SS&houseNumber=0',
      'lookup?postalCode=9999SS&houseNumber=100000',
      `lookup?postalCode=9999SS&houseNumber=1&addition=${'a'.repeat(201)}`,
      'lookup',
    ]) {
      const res = await get(path);
      expect(res.status, path).toBe(400);
      expect(await res.json()).toHaveProperty('errors');
    }
    expect(client.calls).toBe(0);
  });

  it('answers each outcome', async () => {
    const { get } = build();
    const found = await (await get('suggest?q=voorbeeldstraat 12')).json();
    expect(found).toMatchObject({ status: 'ok', suggestions: [{ label: 'Voorbeeldstraat 12, 9999 SS Testdorp' }] });
    expect(await (await get('suggest?q=zzzzz')).json()).toEqual({ status: 'ok', suggestions: [] });
    const id = (found as { suggestions: { id: string }[] }).suggestions[0]?.id;
    expect(await (await get(`lookup?id=${id}`)).json()).toMatchObject({ status: 'found', address: { street: 'Voorbeeldstraat', city: 'Testdorp' } });
    expect(await (await get(`lookup?id=adr-${'f'.repeat(32)}`)).json()).toEqual({ status: 'not_found' });
    expect(await (await get('lookup?postalCode=9999ss&houseNumber=14&addition=zz')).json()).toEqual({ status: 'several', additions: ['1', 'A', 'A-2'] });
    expect(await (await get('lookup?postalCode=9999SS&houseNumber=14&addition=a%202')).json()).toMatchObject({ status: 'found', address: { houseNumberAddition: 'A-2' } });
    expect(await (await get('lookup?postalCode=1011AB&houseNumber=7')).json()).toEqual({ status: 'not_found' });
    const down = await get('suggest?q=9990 SD');
    expect(down.status).toBe(200);
    expect(await down.json()).toEqual({ status: 'unavailable' });
  });

  it('answers unavailable when the client throws', async () => {
    const boom = async () => {
      throw new Error('secret detail');
    };
    const { get } = build({ suggest: boom, lookupById: boom, lookupByPostalCode: boom });
    for (const path of ['suggest?q=abc', `lookup?id=${ID}`, 'lookup?postalCode=9999SS&houseNumber=1']) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'unavailable' });
    }
  });

  it('logs only the outcome and duration', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { get } = build();
    await get('suggest?q=voorbeeldstraat 12');
    await get('lookup?postalCode=9999SS&houseNumber=14&addition=zz');
    const lines = write.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('address call'));
    write.mockRestore();
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string)).toMatchObject({ kind: 'suggest', outcome: 'found' });
    expect(JSON.parse(lines[1] as string)).toMatchObject({ kind: 'lookup', outcome: 'several' });
    for (const l of lines) {
      expect(l).not.toMatch(/voorbeeld|9999|testdorp/i);
      expect(JSON.parse(l)).toHaveProperty('durationMs');
    }
  });
});
