import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { type AuthDeps, loadAuthConfig } from './auth.js';
import { createSessionStore, createUserStore } from './authStores.js';
import { checkDb, connect, migrate } from './db.js';
import { createGoogleClient } from './googleClient.js';
import { logger } from './logger.js';
import { createPropertyRepository } from './propertyRepository.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  logger.error('DATABASE_URL is not set');
  process.exit(1);
}

let authConfig: ReturnType<typeof loadAuthConfig>;
try {
  authConfig = loadAuthConfig(process.env);
} catch (err) {
  logger.error('sign-in is not configured, refusing to start', { error: String(err) });
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };
const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

const sql = connect(databaseUrl);

try {
  await migrate(sql, migrationsDir);
} catch (err) {
  logger.error('migration failed', { error: String(err) });
  process.exit(1);
}

const auth: AuthDeps = {
  mode: authConfig.mode,
  google: authConfig.mode === 'google' ? createGoogleClient(authConfig) : undefined,
  users: createUserStore(sql),
  sessions: createSessionStore(sql),
};
await auth.sessions.purgeExpired(new Date());

const app = createApp({ checkDb: () => checkDb(sql), properties: createPropertyRepository(sql), version, auth });

serve({ fetch: app.fetch, port }, (info) => {
  logger.info('api listening', { port: info.port, version, signIn: authConfig.mode });
});
