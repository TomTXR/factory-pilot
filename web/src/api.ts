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
