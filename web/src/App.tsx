import { useEffect, useState } from 'react';
import { type ApiStatus, fetchHealth, fetchVersion } from './api';

const statusStyle: Record<ApiStatus, string> = {
  loading: 'bg-gray-100 text-gray-700',
  ok: 'bg-green-100 text-green-800',
  degraded: 'bg-amber-100 text-amber-800',
  unreachable: 'bg-red-100 text-red-800',
};

export function App({
  loadHealth = fetchHealth,
  loadVersion = fetchVersion,
}: {
  loadHealth?: () => Promise<ApiStatus>;
  loadVersion?: () => Promise<string | null>;
}) {
  const [status, setStatus] = useState<ApiStatus>('loading');
  const [version, setVersion] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadHealth().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, [loadHealth]);

  useEffect(() => {
    let active = true;
    loadVersion().then((v) => {
      if (active) setVersion(v);
    });
    return () => {
      active = false;
    };
  }, [loadVersion]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Home Maintenance Log</h1>
        <span data-testid="api-status" className={`rounded px-2 py-1 text-sm ${statusStyle[status]}`}>
          API: {status}
        </span>
      </header>
      <section className="mt-8 rounded border border-dashed border-gray-300 p-8 text-center text-gray-600">
        No properties yet.
      </section>
      {version !== undefined && (
        <footer data-testid="app-version" className="mt-8 break-words text-sm text-gray-600">
          Version {version ?? 'unknown'}
        </footer>
      )}
    </main>
  );
}
