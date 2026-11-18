import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { checkDb, connect, migrate } from './db.js';
import { logger } from './logger.js';
import { createPropertyRepository } from './propertyRepository.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  logger.error('DATABASE_URL is not set');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const version = process.env.APP_VERSION ?? 'dev';
const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

const sql = connect(databaseUrl);

try {
  await migrate(sql, migrationsDir);
} catch (err) {
  logger.error('migration failed', { error: String(err) });
  process.exit(1);
}

const app = createApp({ checkDb: () => checkDb(sql), properties: createPropertyRepository(sql), version });

serve({ fetch: app.fetch, port }, (info) => {
  logger.info('api listening', { port: info.port, version });
});
