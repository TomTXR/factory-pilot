import { Hono } from 'hono';
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
  /** Clock, replaceable in tests. */
  now?: () => Date;
}

const DUPLICATE = { error: 'This property already exists' };
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

  const { routes, requireUser } = createAuth(
    deps.auth,
    deps.now ?? (() => new Date()),
    async (user) => {
      // Properties created before accounts existed go to the first account that signs in.
      // A failed claim is logged and never blocks the sign-in.
      try {
        const claimed = await deps.properties.claimUnowned(user.id);
        if (claimed > 0) logger.info('claimed unowned properties', { userId: user.id, count: claimed });
      } catch (err) {
        logger.error('claim of unowned properties failed', { userId: user.id, error: String(err) });
      }
    },
  );
  app.route('/auth', routes);

  // Everything below is protected; /health, /version and /auth stay public.
  app.use('/properties', requireUser);
  app.use('/properties/*', requireUser);

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
