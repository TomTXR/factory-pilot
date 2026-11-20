import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { type GoogleClient, loadAuthConfig, SESSION_TTL_MS } from './auth.js';
import { verifyIdToken } from './googleClient.js';
import { createStubAddressClient } from './addressStub.js';
import { memoryRepository, testAuth } from './testing.js';

function build(mode: 'test' | 'google' = 'test', now: () => Date = () => new Date()) {
  const exchanged: { code: string; codeVerifier: string; nonce: string }[] = [];
  let fail = false;
  const google: GoogleClient = {
    authorizationUrl: ({ state, nonce, codeChallenge }) =>
      `https://google.test/auth?state=${state}&nonce=${nonce}&code_challenge=${codeChallenge}`,
    async exchange(p) {
      exchanged.push(p);
      if (fail) throw new Error('bad token');
      return { sub: 'g-1', email: 'anna@example.com', name: 'Anna' };
    },
  };
  const auth = testAuth(mode, mode === 'google' ? google : undefined);
  const app = createApp({ checkDb: async () => true, properties: memoryRepository(), version: 'v', auth, address: createStubAddressClient(), now });
  return { app, auth, exchanged, failNext: () => (fail = true) };
}

const cookieOf = (res: Response, name: string) =>
  (res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)) ?? '').split(';')[0] ?? '';

async function beginGoogle(app: ReturnType<typeof build>['app']) {
  const res = await app.request('/api/auth/login');
  const url = new URL(res.headers.get('location') ?? '');
  return { res, state: url.searchParams.get('state') ?? '', loginCookie: cookieOf(res, 'pilot_login'), url };
}

describe('property routes without a session', () => {
  it.each([
    ['GET', '/api/properties'],
    ['POST', '/api/properties'],
    ['GET', '/api/properties/00000000-0000-4000-8000-000000000001'],
    ['PUT', '/api/properties/00000000-0000-4000-8000-000000000001'],
    ['DELETE', '/api/properties/00000000-0000-4000-8000-000000000001'],
  ])('%s %s answers 401', async (method, path) => {
    const { app } = build();
    const res = await app.request(path, { method });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not signed in' });
  });

  it('keeps health, version and config public', async () => {
    const { app } = build();
    expect((await app.request('/api/health')).status).toBe(200);
    expect((await app.request('/api/version')).status).toBe(200);
    expect(await (await app.request('/api/auth/config')).json()).toEqual({ mode: 'test' });
  });

  it('answers 401 for an unknown session cookie', async () => {
    const { app } = build();
    const res = await app.request('/api/properties', { headers: { cookie: 'pilot_session=nope' } });
    expect(res.status).toBe(401);
  });
});

describe('test sign-in', () => {
  it('creates a session with a hardened cookie and unlocks the API', async () => {
    const { app } = build();
    const res = await app.request('/api/auth/test-login', { method: 'POST' });
    expect(res.status).toBe(200);
    const raw = res.headers.getSetCookie()[0] ?? '';
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Secure/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    const cookie = raw.split(';')[0] ?? '';
    expect((await app.request('/api/properties', { headers: { cookie } })).status).toBe(200);
    const me = await app.request('/api/auth/me', { headers: { cookie } });
    expect(await me.json()).toMatchObject({ email: 'test.user@example.com' });
  });

  it('answers 404 in google mode', async () => {
    const { app } = build('google');
    expect((await app.request('/api/auth/test-login', { method: 'POST' })).status).toBe(404);
  });

  it('rejects an unknown test user', async () => {
    const { app } = build();
    const res = await app.request('/api/auth/test-login', { method: 'POST', body: JSON.stringify({ user: 'zzz' }) });
    expect(res.status).toBe(400);
  });
});

describe('google sign-in', () => {
  it('redirects to Google with state and a PKCE challenge, in the same tab', async () => {
    const { app } = build('google');
    const { res, state, url } = await beginGoogle(app);
    expect(res.status).toBe(302);
    expect(url.host).toBe('google.test');
    expect(state).not.toBe('');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    const raw = res.headers.getSetCookie()[0] ?? '';
    expect(raw).toMatch(/HttpOnly/i);
  });

  it('answers 404 for login in test mode', async () => {
    const { app } = build('test');
    expect((await app.request('/api/auth/login')).status).toBe(404);
  });

  it('creates an account on first sign-in and reuses it on the next', async () => {
    const { app, auth, exchanged } = build('google');
    for (let i = 0; i < 2; i++) {
      const { state, loginCookie } = await beginGoogle(app);
      const res = await app.request(`/api/auth/callback?state=${state}&code=abc`, { headers: { cookie: loginCookie } });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/');
      const session = cookieOf(res, 'pilot_session');
      expect((await app.request('/api/properties', { headers: { cookie: session } })).status).toBe(200);
    }
    expect(auth.userCount()).toBe(1);
    expect(auth.sessionCount()).toBe(2);
    expect(exchanged[0]?.codeVerifier).toBeTruthy();
  });

  it('rejects a state that does not match the cookie', async () => {
    const { app, auth } = build('google');
    const { state } = await beginGoogle(app);
    const res = await app.request(`/api/auth/callback?state=${state}&code=abc`, {
      headers: { cookie: 'pilot_login=other' },
    });
    expect(res.headers.get('location')).toBe('/?auth_error=1');
    expect(auth.userCount()).toBe(0);
  });

  it('rejects a state that was never issued', async () => {
    const { app, auth } = build('google');
    const res = await app.request('/api/auth/callback?state=forged&code=abc', { headers: { cookie: 'pilot_login=forged' } });
    expect(res.headers.get('location')).toBe('/?auth_error=1');
    expect(auth.userCount()).toBe(0);
  });

  it('rejects a replayed callback', async () => {
    const { app, auth } = build('google');
    const { state, loginCookie } = await beginGoogle(app);
    const url = `/api/auth/callback?state=${state}&code=abc`;
    expect((await app.request(url, { headers: { cookie: loginCookie } })).headers.get('location')).toBe('/');
    const again = await app.request(url, { headers: { cookie: loginCookie } });
    expect(again.headers.get('location')).toBe('/?auth_error=1');
    expect(auth.sessionCount()).toBe(1);
  });

  it('rejects an expired login attempt', async () => {
    let t = new Date('2026-01-01T00:00:00Z');
    const { app } = build('google', () => t);
    const { state, loginCookie } = await beginGoogle(app);
    t = new Date(t.getTime() + 11 * 60 * 1000);
    const res = await app.request(`/api/auth/callback?state=${state}&code=abc`, { headers: { cookie: loginCookie } });
    expect(res.headers.get('location')).toBe('/?auth_error=1');
  });

  it('returns to the login screen when Google reports an error', async () => {
    const { app, auth } = build('google');
    const { state, loginCookie } = await beginGoogle(app);
    const res = await app.request(`/api/auth/callback?state=${state}&error=access_denied`, {
      headers: { cookie: loginCookie },
    });
    expect(res.headers.get('location')).toBe('/?auth_error=1');
    expect(auth.userCount()).toBe(0);
  });

  it('creates no account when the ID token is rejected', async () => {
    const { app, auth, failNext } = build('google');
    failNext();
    const { state, loginCookie } = await beginGoogle(app);
    const res = await app.request(`/api/auth/callback?state=${state}&code=abc`, { headers: { cookie: loginCookie } });
    expect(res.headers.get('location')).toBe('/?auth_error=1');
    expect(auth.userCount()).toBe(0);
    expect(auth.sessionCount()).toBe(0);
  });
});

describe('sessions', () => {
  async function signIn(app: ReturnType<typeof build>['app']) {
    const res = await app.request('/api/auth/test-login', { method: 'POST' });
    return cookieOf(res, 'pilot_session');
  }

  it('expires 30 days after the last use and slides forward on use', async () => {
    let t = new Date('2026-01-01T00:00:00Z');
    const { app } = build('test', () => t);
    const cookie = await signIn(app);
    t = new Date(t.getTime() + SESSION_TTL_MS - 1000);
    const used = await app.request('/api/properties', { headers: { cookie } });
    expect(used.status).toBe(200);
    expect(cookieOf(used, 'pilot_session')).toBe(cookie);
    t = new Date(t.getTime() + SESSION_TTL_MS - 1000);
    expect((await app.request('/api/properties', { headers: { cookie } })).status).toBe(200);
    t = new Date(t.getTime() + SESSION_TTL_MS + 1000);
    expect((await app.request('/api/properties', { headers: { cookie } })).status).toBe(401);
  });

  it('ends the session on the server at logout', async () => {
    const { app, auth } = build();
    const cookie = await signIn(app);
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    expect(res.status).toBe(204);
    expect(auth.sessionCount()).toBe(0);
    expect((await app.request('/api/properties', { headers: { cookie } })).status).toBe(401);
    expect((await app.request('/api/auth/me', { headers: { cookie } })).status).toBe(401);
  });
});

describe('loadAuthConfig', () => {
  const google = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret', PUBLIC_BASE_URL: 'https://pilot.example/' };

  it('uses google when configured, even on a preview project', () => {
    expect(loadAuthConfig({ ...google, DEPLOY_PROJECT: 'pilot-prod' })).toMatchObject({
      mode: 'google',
      publicBaseUrl: 'https://pilot.example',
    });
  });

  it('refuses production without google settings', () => {
    expect(() => loadAuthConfig({ DEPLOY_PROJECT: 'pilot-prod' })).toThrow(/GOOGLE_CLIENT_ID/);
    expect(() => loadAuthConfig({ DEPLOY_PROJECT: 'pilot-prod', GOOGLE_CLIENT_ID: 'id' })).toThrow();
  });

  it('refuses an unknown or missing project without google settings', () => {
    expect(() => loadAuthConfig({})).toThrow();
    expect(() => loadAuthConfig({ DEPLOY_PROJECT: 'something-else' })).toThrow();
  });

  it('allows the test sign-in on local, CI and preview stacks', () => {
    for (const DEPLOY_PROJECT of ['pilot-dev', 'pilot-pr-34']) {
      expect(loadAuthConfig({ DEPLOY_PROJECT }).mode).toBe('test');
    }
  });

  it('requires a public base url for google', () => {
    expect(() => loadAuthConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' })).toThrow(/PUBLIC_BASE_URL/);
  });
});

describe('verifyIdToken', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1' }] };
  const now = new Date('2026-01-01T00:00:00Z');
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

  function token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
    const h = b64({ alg: 'RS256', kid: 'k1', ...header });
    const b = b64({
      iss: 'https://accounts.google.com',
      aud: 'client',
      exp: now.getTime() / 1000 + 60,
      nonce: 'n1',
      sub: 'g-1',
      email: 'anna@example.com',
      name: 'Anna',
      ...claims,
    });
    return `${h}.${b}.${sign('RSA-SHA256', Buffer.from(`${h}.${b}`), privateKey).toString('base64url')}`;
  }
  const verify = (t: string) => verifyIdToken(t, { jwks, clientId: 'client', nonce: 'n1', now });

  it('accepts a valid token', () => {
    expect(verify(token())).toEqual({ sub: 'g-1', email: 'anna@example.com', name: 'Anna' });
  });

  it('falls back to the email when there is no name', () => {
    expect(verify(token({ name: undefined })).name).toBe('anna@example.com');
  });

  it.each([
    ['wrong audience', { aud: 'other' }],
    ['wrong issuer', { iss: 'https://evil.test' }],
    ['expired', { exp: now.getTime() / 1000 - 1 }],
    ['wrong nonce', { nonce: 'x' }],
    ['no subject', { sub: undefined }],
  ])('rejects %s', (_label, claims) => {
    expect(() => verify(token(claims))).toThrow();
  });

  it('rejects an unknown key, a bad algorithm and a tampered token', () => {
    expect(() => verify(token({}, { kid: 'other' }))).toThrow();
    expect(() => verify(token({}, { alg: 'none' }))).toThrow();
    const [h, , s] = token().split('.') as [string, string, string];
    expect(() => verify(`${h}.${b64({ sub: 'attacker', aud: 'client' })}.${s}`)).toThrow();
  });
});
