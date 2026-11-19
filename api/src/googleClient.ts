import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';
import type { GoogleClient, GoogleIdentity } from './auth.js';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export type Jwks = { keys: (JsonWebKey & { kid?: string })[] };

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

/** Verifies signature (RS256 against the given keys), issuer, audience, expiry and nonce. */
export function verifyIdToken(
  idToken: string,
  p: { jwks: Jwks; clientId: string; nonce: string; now: Date },
): GoogleIdentity {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed id token');
  const [h, b, s] = parts as [string, string, string];
  const header = decodePart(h);
  if (header.alg !== 'RS256') throw new Error('unexpected id token algorithm');
  const jwk = p.jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('unknown id token key');
  const valid = verify(
    'RSA-SHA256',
    Buffer.from(`${h}.${b}`),
    createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(s, 'base64url'),
  );
  if (!valid) throw new Error('bad id token signature');

  const claims = decodePart(b);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ISSUERS.includes(String(claims.iss))) throw new Error('bad id token issuer');
  if (!aud.includes(p.clientId)) throw new Error('bad id token audience');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= p.now.getTime()) throw new Error('id token expired');
  if (claims.nonce !== p.nonce) throw new Error('bad id token nonce');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('id token has no subject');
  if (typeof claims.email !== 'string' || !claims.email) throw new Error('id token has no email');
  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : claims.email;
  return { sub: claims.sub, email: claims.email, name };
}

export function createGoogleClient(cfg: {
  clientId: string;
  clientSecret: string;
  publicBaseUrl: string;
  fetchFn?: typeof fetch;
}): GoogleClient {
  const fetchFn = cfg.fetchFn ?? fetch;
  const redirectUri = `${cfg.publicBaseUrl}/api/auth/callback`;
  return {
    authorizationUrl({ state, nonce, codeChallenge }) {
      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      return `${AUTH_ENDPOINT}?${params.toString()}`;
    },
    async exchange({ code, codeVerifier, nonce }) {
      const tokenRes = await fetchFn(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
      });
      if (!tokenRes.ok) throw new Error(`token exchange failed with status ${tokenRes.status}`);
      const { id_token: idToken } = (await tokenRes.json()) as { id_token?: unknown };
      if (typeof idToken !== 'string') throw new Error('token response has no id_token');
      const keysRes = await fetchFn(JWKS_URL);
      if (!keysRes.ok) throw new Error(`key fetch failed with status ${keysRes.status}`);
      const jwks = (await keysRes.json()) as Jwks;
      return verifyIdToken(idToken, { jwks, clientId: cfg.clientId, nonce, now: new Date() });
    },
  };
}
