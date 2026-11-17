import { Hono } from 'hono';

export interface AppDeps {
  /** Returns true when the database answers a trivial query. */
  checkDb: () => Promise<boolean>;
  version: string;
}

/** Builds the HTTP app. Dependencies are injected so routes can be tested without a database. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono().basePath('/api');

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

  return app;
}
