import { Hono } from 'hono';
import {
  type AddressClient,
  isAddressId,
  isValidAddition,
  normaliseHouseNumber,
  normalisePostalCode,
} from './addressClient.js';
import type { AuthDeps } from './auth.js';
import { createAuth } from './authRoutes.js';
import { logger } from './logger.js';
import { isUuid, type PropertyRepository, validateProperty } from './properties.js';

export interface AppDeps {
  /** Returns true when the database answers a trivial query. */
  checkDb: () => Promise<boolean>;
  properties: PropertyRepository;
  version: string;
  auth: AuthDeps;
  address: AddressClient;
  /** Clock, replaceable in tests. */
  now?: () => Date;
}

const DUPLICATE = { error: 'This property already exists' };
const MIN_SEARCH = 3;
const MAX_SEARCH = 100;
const NOT_FOUND = { error: 'Property not found' };

/** Builds the HTTP app. Dependencies are injected so routes can be tested without a database. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono().basePath('/api');

  app.onError((err, c) => {
    logger.error('request failed', { path: c.req.path, error: String(err) });
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.get('/health', async (c) => {
    let db = false;
    try {
      db = await deps.checkDb();
    } catch {
      db = false;
    }
    return c.json({ status: db ? 'ok' : 'degraded', db }, db ? 200 : 503);
  });

  app.get('/version', (c) => c.json({ version: deps.version }));

  const { routes, requireUser } = createAuth(deps.auth, deps.now ?? (() => new Date()));
  app.route('/auth', routes);

  // Everything below is protected; /health, /version and /auth stay public.
  app.use('/properties', requireUser);
  app.use('/properties/*', requireUser);
  app.use('/address/*', requireUser);

  /** Logs the outcome and duration of an address call. Never the input or the address. */
  const logOutcome = (kind: 'suggest' | 'lookup', outcome: string, started: number) =>
    logger.info('address call', { kind, outcome, durationMs: Date.now() - started });

  app.get('/address/suggest', async (c) => {
    const q = (c.req.query('q') ?? '').trim();
    if (q.length < MIN_SEARCH || q.length > MAX_SEARCH) {
      return c.json({ errors: { q: `Search text must be ${MIN_SEARCH} to ${MAX_SEARCH} characters` } }, 400);
    }
    const started = Date.now();
    const result = await deps.address.suggest(q).catch((): { status: 'unavailable' } => ({ status: 'unavailable' }));
    logOutcome('suggest', result.status === 'ok' ? (result.suggestions.length > 0 ? 'found' : 'none') : 'unavailable', started);
    return c.json(result);
  });

  app.get('/address/lookup', async (c) => {
    const id = c.req.query('id');
    const started = Date.now();
    let result: { status: string };
    if (id !== undefined) {
      if (!isAddressId(id)) return c.json({ errors: { id: 'Address id is not valid' } }, 400);
      result = await deps.address.lookupById(id).catch((): { status: 'unavailable' } => ({ status: 'unavailable' }));
    } else {
      const errors: Record<string, string> = {};
      const postalCode = normalisePostalCode(c.req.query('postalCode') ?? '');
      const houseNumber = normaliseHouseNumber(c.req.query('houseNumber') ?? '');
      const addition = (c.req.query('addition') ?? '').trim().replace(/\s+/g, ' ');
      if (!postalCode) errors.postalCode = 'Postal code must be 4 digits and 2 letters';
      if (!houseNumber) errors.houseNumber = 'House number must be a number from 1 to 99999';
      if (!isValidAddition(addition)) errors.addition = 'Addition is too long';
      if (!postalCode || !houseNumber || errors.addition) return c.json({ errors }, 400);
      result = await deps
        .address.lookupByPostalCode({ postalCode, houseNumber, addition })
        .catch((): { status: 'unavailable' } => ({ status: 'unavailable' }));
    }
    logOutcome('lookup', result.status === 'not_found' ? 'none' : result.status, started);
    return c.json(result);
  });

  app.get('/properties', async (c) => c.json(await deps.properties.list(c.get('user').id)));

  app.post('/properties', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const result = validateProperty(body);
    if (!result.ok) return c.json({ errors: result.errors }, 400);
    const created = await deps.properties.create(c.get('user').id, result.value);
    if (created === 'duplicate') return c.json(DUPLICATE, 409);
    return c.json(created, 201);
  });

  app.get('/properties/:id', async (c) => {
    const id = c.req.param('id');
    const property = isUuid(id) ? await deps.properties.get(c.get('user').id, id) : null;
    return property ? c.json(property) : c.json(NOT_FOUND, 404);
  });

  app.put('/properties/:id', async (c) => {
    const id = c.req.param('id');
    const body: unknown = await c.req.json().catch(() => null);
    const result = validateProperty(body);
    if (!result.ok) return c.json({ errors: result.errors }, 400);
    if (!isUuid(id)) return c.json(NOT_FOUND, 404);
    const updated = await deps.properties.update(c.get('user').id, id, result.value);
    if (updated === 'duplicate') return c.json(DUPLICATE, 409);
    return updated ? c.json(updated) : c.json(NOT_FOUND, 404);
  });

  app.delete('/properties/:id', async (c) => {
    const id = c.req.param('id');
    const removed = isUuid(id) ? await deps.properties.remove(c.get('user').id, id) : false;
    return removed ? c.body(null, 204) : c.json(NOT_FOUND, 404);
  });

  return app;
}
