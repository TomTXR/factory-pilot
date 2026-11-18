export type ApiStatus = 'loading' | 'ok' | 'degraded' | 'unreachable';

export async function fetchHealth(fetchFn: typeof fetch = fetch): Promise<ApiStatus> {
  try {
    const res = await fetchFn('/api/health');
    const body = (await res.json()) as { status?: string };
    return body.status === 'ok' ? 'ok' : 'degraded';
  } catch {
    return 'unreachable';
  }
}

const SHORT_VERSION_LENGTH = 7;

export async function fetchVersion(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn('/api/version');
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === 'string' ? body.version.slice(0, SHORT_VERSION_LENGTH) : null;
  } catch {
    return null;
  }
}
