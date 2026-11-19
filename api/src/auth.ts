import { createHash, randomBytes } from 'node:crypto';

export interface User {
  id: string;
  email: string;
  name: string;
}

/** Identity taken from a verified Google ID token. `sub` is the stable Google user id. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

export interface UserStore {
  /** Finds the account for this Google user id or creates it, and records the login time. */
  signIn: (identity: GoogleIdentity) => Promise<User>;
}

export interface SessionStore {
  create: (userId: string, tokenHash: string, expiresAt: Date) => Promise<void>;
  /**
   * Returns the user of an unexpired session. When the session was last used more than
   * `refreshAfterMs` ago, its last use and expiry are moved forward and `refreshed` is true.
   */
  find: (
    tokenHash: string,
    now: Date,
    ttlMs: number,
    refreshAfterMs: number,
  ) => Promise<{ user: User; refreshed: boolean } | null>;
  remove: (tokenHash: string) => Promise<void>;
  /** Deletes expired sessions. */
  purgeExpired: (now: Date) => Promise<void>;
}

export interface GoogleClient {
  authorizationUrl: (p: { state: string; nonce: string; codeChallenge: string }) => string;
  /** Exchanges the code and verifies the ID token. Throws when anything does not check out. */
  exchange: (p: { code: string; codeVerifier: string; nonce: string }) => Promise<GoogleIdentity>;
}

/** `google`: real sign-in. `test`: labelled synthetic sign-in for previews, CI and local runs. */
export type AuthMode = 'google' | 'test';

export interface AuthDeps {
  mode: AuthMode;
  /** Present in google mode. */
  google?: GoogleClient;
  users: UserStore;
  sessions: SessionStore;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A session is written to at most this often. */
export const SESSION_REFRESH_MS = 5 * 60 * 1000;

export const TEST_USERS: Record<string, GoogleIdentity> = {
  a: { sub: 'test-user-a', email: 'test.user@example.com', name: 'Test User' },
  b: { sub: 'test-user-b', email: 'test.user.two@example.com', name: 'Test User Two' },
  // Only used by the empty-state e2e test: no spec adds properties for this user.
  c: { sub: 'test-user-c', email: 'test.user.three@example.com', name: 'Test User Three' },
};

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export interface AuthConfig {
  mode: AuthMode;
  clientId: string;
  clientSecret: string;
  publicBaseUrl: string;
}

const NON_PRODUCTION_PROJECT = /^pilot-(dev|pr-\d+)$/;

/**
 * Decides the sign-in mode from the environment. Fail closed: the test sign-in is only
 * possible when the deploy project is clearly a local, CI or preview stack, so a production
 * stack with missing Google settings (or an unknown project) throws instead of running open.
 */
export function loadAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  const publicBaseUrl = (env.PUBLIC_BASE_URL?.trim() ?? '').replace(/\/+$/, '');
  if (clientId && clientSecret) {
    if (!publicBaseUrl) throw new Error('PUBLIC_BASE_URL is required when Google sign-in is configured');
    return { mode: 'google', clientId, clientSecret, publicBaseUrl };
  }
  const project = env.DEPLOY_PROJECT?.trim() ?? '';
  if (NON_PRODUCTION_PROJECT.test(project)) return { mode: 'test', clientId, clientSecret, publicBaseUrl };
  throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required outside local, CI and preview stacks');
}
