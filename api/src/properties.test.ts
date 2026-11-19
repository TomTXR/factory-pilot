import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { memoryRepository, testAuth } from './testing.js';

const valid = {
  street: 'Teststraat',
  houseNumber: '12',
  postalCode: '1234 AB',
  city: 'Teststad',
  ownerName: 'Anna Test',
};

function setup() {
  const app = createApp({ checkDb: async () => true, properties: memoryRepository(), version: 'test', auth: testAuth() });
  let cookie = '';
  const signedIn = Promise.resolve(app.request('/api/auth/test-login', { method: 'POST' })).then((res) => {
    cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  });
  const send = async (method: string, path: string, body?: unknown) => {
    await signedIn;
    return app.request(`/api/properties${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  return { send };
}

describe('POST /api/properties', () => {
  it('creates a property with defaults for the optional fields', async () => {
    const { send } = setup();
    const res = await send('POST', '', valid);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      ...valid,
      country: 'NL',
      displayName: null,
      houseNumberAddition: '',
      propertyType: null,
      yearBuilt: null,
      livingAreaM2: null,
      rooms: null,
      notes: null,
    });
    expect(body.id).toBeTruthy();
  });

  it('saves optional characteristics, accepting numbers typed as text', async () => {
    const { send } = setup();
    const res = await send('POST', '', {
      ...valid,
      displayName: 'Family home',
      country: 'DE',
      propertyType: 'house',
      yearBuilt: '1999',
      livingAreaM2: '120,5',
      rooms: 5,
      notes: 'Corner house',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      displayName: 'Family home',
      country: 'DE',
      propertyType: 'house',
      yearBuilt: 1999,
      livingAreaM2: 120.5,
      rooms: 5,
      notes: 'Corner house',
    });
  });

  it.each(['street', 'houseNumber', 'postalCode', 'city', 'ownerName'])(
    'returns 400 with a field error when %s is missing, and saves nothing',
    async (field) => {
      const { send } = setup();
      const res = await send('POST', '', { ...valid, [field]: '   ' });
      expect(res.status).toBe(400);
      expect(Object.keys((await res.json()).errors)).toEqual([field]);
      expect(await (await send('GET', '')).json()).toEqual([]);
    },
  );

  it.each([
    ['livingAreaM2', -5],
    ['livingAreaM2', 0],
    ['livingAreaM2', 'big'],
    ['yearBuilt', 1499],
    ['yearBuilt', new Date().getUTCFullYear() + 1],
    ['yearBuilt', 'abc'],
    ['yearBuilt', 1999.5],
    ['rooms', 2.5],
    ['rooms', 0],
    ['rooms', 'many'],
    ['propertyType', 'castle'],
    ['country', 'FR'],
  ])('rejects invalid %s = %s', async (field, value) => {
    const { send } = setup();
    const res = await send('POST', '', { ...valid, [field]: value });
    expect(res.status).toBe(400);
    expect(Object.keys((await res.json()).errors)).toEqual([field]);
  });

  it('returns 400 for a body that is not a JSON object', async () => {
    const { send } = setup();
    expect((await send('POST', '', [])).status).toBe(400);
    expect((await send('POST', '', undefined)).status).toBe(400);
  });

  it('returns 409 for a duplicate, ignoring case and repeated whitespace', async () => {
    const { send } = setup();
    expect((await send('POST', '', valid)).status).toBe(201);
    const res = await send('POST', '', { ...valid, street: '  TESTSTRAAT ', ownerName: 'anna   test' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'This property already exists' });
  });

  it('allows the same address for another owner, and the same owner at another address or addition', async () => {
    const { send } = setup();
    await send('POST', '', valid);
    expect((await send('POST', '', { ...valid, ownerName: 'Ben Test' })).status).toBe(201);
    expect((await send('POST', '', { ...valid, houseNumber: '14' })).status).toBe(201);
    expect((await send('POST', '', { ...valid, houseNumberAddition: 'B' })).status).toBe(201);
    expect((await send('POST', '', { ...valid, country: 'DE' })).status).toBe(201);
  });
});

describe('GET /api/properties', () => {
  it('lists properties and gets one by id', async () => {
    const { send } = setup();
    expect(await (await send('GET', '')).json()).toEqual([]);
    const created = await (await send('POST', '', valid)).json();
    const list = await (await send('GET', '')).json();
    expect(list).toHaveLength(1);
    const res = await send('GET', `/${created.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(created);
  });

  it('returns 404 for a missing or malformed id', async () => {
    const { send } = setup();
    expect((await send('GET', '/00000000-0000-4000-8000-000000000099')).status).toBe(404);
    expect((await send('GET', '/not-a-uuid')).status).toBe(404);
  });
});

describe('PUT /api/properties/:id', () => {
  it('replaces the editable fields', async () => {
    const { send } = setup();
    const created = await (await send('POST', '', valid)).json();
    const res = await send('PUT', `/${created.id}`, { ...valid, city: 'Nieuwstad', rooms: 4 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: created.id, city: 'Nieuwstad', rooms: 4 });
  });

  it('does not treat saving unchanged identifying fields as a duplicate of itself', async () => {
    const { send } = setup();
    const created = await (await send('POST', '', valid)).json();
    const res = await send('PUT', `/${created.id}`, { ...valid, notes: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('returns 409 when the new address and owner equal another property', async () => {
    const { send } = setup();
    await send('POST', '', valid);
    const other = await (await send('POST', '', { ...valid, houseNumber: '14' })).json();
    const res = await send('PUT', `/${other.id}`, valid);
    expect(res.status).toBe(409);
  });

  it('returns 400 on invalid input and 404 for a missing id', async () => {
    const { send } = setup();
    const created = await (await send('POST', '', valid)).json();
    expect((await send('PUT', `/${created.id}`, { ...valid, street: '' })).status).toBe(400);
    expect((await send('PUT', '/00000000-0000-4000-8000-000000000099', valid)).status).toBe(404);
  });
});

describe('DELETE /api/properties/:id', () => {
  it('deletes a property', async () => {
    const { send } = setup();
    const created = await (await send('POST', '', valid)).json();
    expect((await send('DELETE', `/${created.id}`)).status).toBe(204);
    expect((await send('GET', `/${created.id}`)).status).toBe(404);
  });

  it('returns 404 for a missing id', async () => {
    const { send } = setup();
    expect((await send('DELETE', '/00000000-0000-4000-8000-000000000099')).status).toBe(404);
  });
});
