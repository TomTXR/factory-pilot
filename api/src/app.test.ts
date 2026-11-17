import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('returns ok when the database answers', async () => {
    const app = createApp({ checkDb: async () => true, version: 'test' });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: true });
  });

  it('returns 503 when the database check fails', async () => {
    const app = createApp({
      checkDb: async () => {
        throw new Error('connection refused');
      },
      version: 'test',
    });
    const res = await app.request('/api/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'degraded', db: false });
  });
});

describe('GET /api/version', () => {
  it('returns the configured version', async () => {
    const app = createApp({ checkDb: async () => true, version: 'abc123' });
    const res = await app.request('/api/version');
    expect(await res.json()).toEqual({ version: 'abc123' });
  });
});
