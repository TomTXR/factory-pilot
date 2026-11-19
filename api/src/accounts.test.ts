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
  const repo = memoryRepository();
  const app = createApp({ checkDb: async () => true, properties: repo, version: 'test', auth: testAuth() });
  const signIn = async (user: string) => {
    const res = await app.request('/api/auth/test-login', { method: 'POST', body: JSON.stringify({ user }) });
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    return (method: string, path = '', body?: unknown) =>
      app.request(`/api/properties${path}`, {
        method,
        headers: { 'content-type': 'application/json', cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
  };
  return { repo, signIn };
}

describe('properties per account', () => {
  it('lists only the properties of the signed-in account', async () => {
    const { signIn } = setup();
    const a = await signIn('a');
    const b = await signIn('b');
    await a('POST', '', valid);
    await b('POST', '', { ...valid, street: 'Otherstraat' });
    const listA = (await (await a('GET')).json()) as { street: string }[];
    const listB = (await (await b('GET')).json()) as { street: string }[];
    expect(listA.map((p) => p.street)).toEqual(['Teststraat']);
    expect(listB.map((p) => p.street)).toEqual(['Otherstraat']);
  });

  it('answers 404 with the same body for another account as for an unknown id, and changes nothing', async () => {
    const { signIn } = setup();
    const a = await signIn('a');
    const b = await signIn('b');
    const created = (await (await a('POST', '', valid)).json()) as { id: string };
    const unknown = '00000000-0000-4000-8000-0000000000ff';
    for (const [method, body] of [['GET'], ['PUT', valid], ['DELETE']] as [string, unknown?][]) {
      const other = await b(method, `/${created.id}`, body);
      const missing = await b(method, `/${unknown}`, body);
      expect(other.status).toBe(404);
      expect(await other.text()).toBe(await missing.text());
    }
    const stillThere = (await (await a('GET', `/${created.id}`)).json()) as { ownerName: string };
    expect(stillThere.ownerName).toBe('Anna Test');
  });

  it('does not change another account when it tries to update with new values', async () => {
    const { signIn } = setup();
    const a = await signIn('a');
    const b = await signIn('b');
    const created = (await (await a('POST', '', valid)).json()) as { id: string };
    await b('PUT', `/${created.id}`, { ...valid, city: 'Hacked' });
    const after = (await (await a('GET', `/${created.id}`)).json()) as { city: string };
    expect(after.city).toBe('Teststad');
  });

  it('ignores owner fields in the body and does not expose the owning account', async () => {
    const { signIn } = setup();
    const a = await signIn('a');
    const b = await signIn('b');
    const res = await a('POST', '', { ...valid, ownerUserId: 'u2', accountUserId: 'u2', account: 'u2' });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string };
    expect(JSON.stringify(created)).not.toMatch(/u1|u2|account|ownerUserId/i);
    expect(((await (await b('GET')).json()) as unknown[]).length).toBe(0);
    const updated = await a('PUT', `/${created.id}`, { ...valid, ownerUserId: 'u2' });
    expect(updated.status).toBe(200);
    expect(((await (await b('GET')).json()) as unknown[]).length).toBe(0);
    expect(((await (await a('GET')).json()) as unknown[]).length).toBe(1);
  });

  it('applies the duplicate check per account', async () => {
    const { signIn } = setup();
    const a = await signIn('a');
    const b = await signIn('b');
    expect((await a('POST', '', valid)).status).toBe(201);
    expect((await b('POST', '', valid)).status).toBe(201);
    expect((await a('POST', '', valid)).status).toBe(409);
    const second = (await (await a('POST', '', { ...valid, houseNumber: '13' })).json()) as { id: string };
    expect((await a('PUT', `/${second.id}`, valid)).status).toBe(409);
  });
});

describe('claim of unowned properties', () => {
  it('gives unowned properties to the first account that signs in, and not to later ones', async () => {
    const { repo, signIn } = setup();
    repo.seedUnowned({
      displayName: null,
      street: 'Oldstraat',
      houseNumber: '1',
      houseNumberAddition: '',
      postalCode: '1000 AA',
      city: 'Oudstad',
      country: 'NL',
      ownerName: 'Old Owner',
      propertyType: null,
      yearBuilt: null,
      livingAreaM2: null,
      rooms: null,
      notes: null,
    });
    const a = await signIn('a');
    const b = await signIn('b');
    expect(((await (await a('GET')).json()) as { street: string }[]).map((p) => p.street)).toEqual(['Oldstraat']);
    expect(((await (await b('GET')).json()) as unknown[]).length).toBe(0);
    await signIn('b');
    expect(((await (await a('GET')).json()) as unknown[]).length).toBe(1);
  });
});
