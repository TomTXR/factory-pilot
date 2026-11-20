import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { logger } from './logger.js';
import { createStubAddressClient } from './addressStub.js';
import { memoryRepository, testAuth } from './testing.js';

const property = (street: string) => ({
  street,
  houseNumber: '1',
  postalCode: '1234 AB',
  city: 'Teststad',
  ownerName: 'Anna Test',
});

function setup() {
  const repo = memoryRepository();
  const auth = testAuth('test', undefined, repo.removeAllOf);
  const app = createApp({ checkDb: async () => true, properties: repo, version: 'test', auth, address: createStubAddressClient() });
  const signIn = async (user: string) => {
    const res = await app.request('/api/auth/test-login', { method: 'POST', body: JSON.stringify({ user }) });
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const call = (method: string, path: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { 'content-type': 'application/json', cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    return { cookie, call };
  };
  return { app, auth, signIn };
}

describe('DELETE /api/auth/account', () => {
  it('answers 401 without a session and deletes nothing', async () => {
    const { app, auth, signIn } = setup();
    const a = await signIn('a');
    await a.call('POST', '/api/properties', property('Teststraat'));
    const res = await app.request('/api/auth/account', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    expect(res.status).toBe(401);
    expect(auth.userCount()).toBe(1);
    expect(((await (await a.call('GET', '/api/properties')).json()) as unknown[]).length).toBe(1);
  });

  it.each([undefined, {}, { confirm: 'delete' }, { confirm: ' DELETE ' }, { confirm: true }])(
    'answers 400 and deletes nothing for the body %j',
    async (body) => {
      const { auth, signIn } = setup();
      const a = await signIn('a');
      await a.call('POST', '/api/properties', property('Teststraat'));
      const res = await a.call('DELETE', '/api/auth/account', body);
      expect(res.status).toBe(400);
      expect(auth.userCount()).toBe(1);
      expect((await a.call('GET', '/api/properties')).status).toBe(200);
      expect(((await (await a.call('GET', '/api/properties')).json()) as unknown[]).length).toBe(1);
    },
  );

  it('deletes the own user, sessions and properties and clears the cookie', async () => {
    const { auth, signIn } = setup();
    const a = await signIn('a');
    const a2 = await signIn('a');
    await a.call('POST', '/api/properties', property('Eerststraat'));
    await a.call('POST', '/api/properties', property('Tweedestraat'));
    expect(auth.sessionCount()).toBe(2);

    const res = await a.call('DELETE', '/api/auth/account', { confirm: 'DELETE' });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie().join(';')).toMatch(/pilot_session=;/);
    expect(auth.userCount()).toBe(0);
    expect(auth.sessionCount()).toBe(0);
    // The session of a second device is invalid on its next call.
    expect((await a2.call('GET', '/api/properties')).status).toBe(401);
    expect((await a.call('GET', '/api/auth/me')).status).toBe(401);
  });

  it('leaves the properties and session of another account unchanged', async () => {
    const { signIn } = setup();
    const a = await signIn('a');
    const b = await signIn('b');
    await a.call('POST', '/api/properties', property('Astraat'));
    await b.call('POST', '/api/properties', property('Bstraat'));
    expect((await a.call('DELETE', '/api/auth/account', { confirm: 'DELETE' })).status).toBe(204);
    const list = (await (await b.call('GET', '/api/properties')).json()) as { street: string }[];
    expect(list.map((p) => p.street)).toEqual(['Bstraat']);
  });

  it('takes no user id from the request', async () => {
    const { signIn } = setup();
    const a = await signIn('a');
    const b = await signIn('b');
    const res = await a.call('DELETE', '/api/auth/account?userId=u2', { confirm: 'DELETE', userId: 'u2' });
    expect(res.status).toBe(204);
    expect((await b.call('GET', '/api/auth/me')).status).toBe(200);
  });

  it('logs the user id and property count, without email or name', async () => {
    const { signIn } = setup();
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const a = await signIn('a');
    await a.call('POST', '/api/properties', property('Teststraat'));
    await a.call('DELETE', '/api/auth/account', { confirm: 'DELETE' });
    const call = info.mock.calls.find((c) => c[0] === 'account deleted');
    info.mockRestore();
    expect(call?.[1]).toEqual({ userId: 'u1', deletedProperties: 1 });
    expect(JSON.stringify(call)).not.toMatch(/example\.com|Test User/);
  });

  it('creates a new, empty account when the same user signs in again', async () => {
    const { auth, signIn } = setup();
    const a = await signIn('a');
    await a.call('POST', '/api/properties', property('Teststraat'));
    await a.call('DELETE', '/api/auth/account', { confirm: 'DELETE' });
    const again = await signIn('a');
    expect(auth.userCount()).toBe(1);
    expect((await again.call('GET', '/api/auth/me')).status).toBe(200);
    expect(await (await again.call('GET', '/api/properties')).json()).toEqual([]);
  });
});
