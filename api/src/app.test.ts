import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createStubAddressClient } from './addressStub.js';
import { memoryRepository, testAuth } from './testing.js';

describe('GET /api/health', () => {
  it('returns ok when the database answers', async () => {
    const app = createApp({ checkDb: async () => true, properties: memoryRepository(), version: 'test', auth: testAuth(), address: createStubAddressClient() });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: true });
  });

  it('returns 503 when the database check fails', async () => {
    const app = createApp({
      checkDb: async () => {
        throw new Error('connection refused');
      },
      properties: memoryRepository(),
      version: 'test',
      auth: testAuth(),
      address: createStubAddressClient(),
    });
    const res = await app.request('/api/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'degraded', db: false });
  });
});

describe('GET /api/version', () => {
  it('returns the configured version', async () => {
    const app = createApp({ checkDb: async () => true, properties: memoryRepository(), version: 'abc123', auth: testAuth(), address: createStubAddressClient() });
    const res = await app.request('/api/version');
    expect(await res.json()).toEqual({ version: 'abc123' });
  });
});
