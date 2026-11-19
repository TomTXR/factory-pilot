import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  type AuthDeps,
  hashToken,
  newToken,
  pkceChallenge,
  SESSION_REFRESH_MS,
  SESSION_TTL_MS,
  TEST_USERS,
  type User,
} from './auth.js';
import { logger } from './logger.js';

const SESSION_COOKIE = 'pilot_session';
const LOGIN_COOKIE = 'pilot_login';
const LOGIN_TTL_MS = 10 * 60 * 1000;
const FAILED_REDIRECT = '/?auth_error=1';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

interface PendingLogin {
  verifier: string;
  nonce: string;
  expiresAt: number;
}

function sessionCookie(c: Context, token: string, maxAgeMs: number): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

/** Builds the sign-in routes (mounted under /api/auth) and the middleware that protects other routes. */
export function createAuth(
  auth: AuthDeps,
  now: () => Date,
  onSignIn: (user: User) => Promise<void>,
): { routes: Hono; requireUser: MiddlewareHandler } {
  // Pending Google sign-ins by state. Entries are single use and short lived.
  const pending = new Map<string, PendingLogin>();
  const purgePending = () => {
    for (const [state, p] of pending) if (p.expiresAt <= now().getTime()) pending.delete(state);
  };

  async function startSession(c: Context, user: User): Promise<void> {
    await onSignIn(user);
    const token = newToken();
    await auth.sessions.create(user.id, hashToken(token), new Date(now().getTime() + SESSION_TTL_MS));
    sessionCookie(c, token, SESSION_TTL_MS);
  }

  const requireUser: MiddlewareHandler = async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const found = token
      ? await auth.sessions.find(hashToken(token), now(), SESSION_TTL_MS, SESSION_REFRESH_MS)
      : null;
    if (!token || !found) return c.json({ error: 'Not signed in' }, 401);
    if (found.refreshed) sessionCookie(c, token, SESSION_TTL_MS);
    c.set('user', found.user);
    await next();
  };

  const routes = new Hono();

  routes.get('/config', (c) => c.json({ mode: auth.mode }));

  routes.get('/me', requireUser, (c) => c.json(c.get('user')));

  routes.get('/login', (c) => {
    if (auth.mode !== 'google' || !auth.google) return c.json({ error: 'Not found' }, 404);
    purgePending();
    const state = newToken();
    const verifier = newToken();
    const nonce = newToken();
    pending.set(state, { verifier, nonce, expiresAt: now().getTime() + LOGIN_TTL_MS });
    setCookie(c, LOGIN_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/api/auth',
      maxAge: LOGIN_TTL_MS / 1000,
    });
    return c.redirect(auth.google.authorizationUrl({ state, nonce, codeChallenge: pkceChallenge(verifier) }), 302);
  });

  routes.get('/callback', async (c) => {
    const cookieState = getCookie(c, LOGIN_COOKIE);
    deleteCookie(c, LOGIN_COOKIE, { path: '/api/auth' });
    const state = c.req.query('state');
    const code = c.req.query('code');
    // Single use: the pending entry is removed whatever the outcome.
    const login = state ? pending.get(state) : undefined;
    if (state) pending.delete(state);
    if (c.req.query('error')) {
      logger.warn('google sign-in not completed', { error: c.req.query('error') });
      return c.redirect(FAILED_REDIRECT, 302);
    }
    if (
      auth.mode !== 'google' ||
      !auth.google ||
      !state ||
      !code ||
      !login ||
      cookieState !== state ||
      login.expiresAt <= now().getTime()
    ) {
      logger.warn('google sign-in rejected: state check failed');
      return c.redirect(FAILED_REDIRECT, 302);
    }
    try {
      const identity = await auth.google.exchange({ code, codeVerifier: login.verifier, nonce: login.nonce });
      const user = await auth.users.signIn(identity);
      await startSession(c, user);
      return c.redirect('/', 302);
    } catch (err) {
      logger.warn('google sign-in failed', { error: String(err) });
      return c.redirect(FAILED_REDIRECT, 302);
    }
  });

  routes.post('/test-login', async (c) => {
    if (auth.mode !== 'test') return c.json({ error: 'Not found' }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { user?: unknown };
    const identity = TEST_USERS[typeof body.user === 'string' ? body.user : 'a'];
    if (!identity) return c.json({ error: 'Unknown test user' }, 400);
    const user = await auth.users.signIn(identity);
    await startSession(c, user);
    return c.json(user);
  });

  routes.post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await auth.sessions.remove(hashToken(token));
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
    return c.body(null, 204);
  });

  return { routes, requireUser };
}
