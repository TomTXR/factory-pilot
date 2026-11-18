import { useCallback, useEffect, useState } from 'react';
import {
  type ApiStatus,
  createPropertiesApi,
  fetchHealth,
  fetchVersion,
  type Property,
  type PropertiesApi,
  type PropertyFormValues,
} from './api';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { EmptyState } from './components/EmptyState';
import { emptyValues, PropertyForm, valuesFromProperty } from './components/PropertyForm';
import { PropertyDetails } from './components/PropertyDetails';
import { PropertySwitcher } from './components/PropertySwitcher';

const statusStyle: Record<ApiStatus, string> = {
  loading: 'bg-gray-100 text-gray-700',
  ok: 'bg-green-100 text-green-800',
  degraded: 'bg-amber-100 text-amber-800',
  unreachable: 'bg-red-100 text-red-800',
};

const SELECTED_KEY = 'selectedPropertyId';
const defaultApi = createPropertiesApi();

function storedSelection(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

function storeSelection(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {
    // Storage can be unavailable (private mode); the selection then lasts for this visit only.
  }
}

type Mode = 'view' | 'add' | 'edit';
type Load = 'loading' | 'error' | 'ready';

export function App({
  loadHealth = fetchHealth,
  loadVersion = fetchVersion,
  api = defaultApi,
}: {
  loadHealth?: () => Promise<ApiStatus>;
  loadVersion?: () => Promise<string | null>;
  api?: PropertiesApi;
}) {
  const [status, setStatus] = useState<ApiStatus>('loading');
  const [version, setVersion] = useState<string | null | undefined>(undefined);
  const [properties, setProperties] = useState<Property[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(storedSelection);
  const [mode, setMode] = useState<Mode>('view');
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    storeSelection(id);
  }, []);

  const reload = useCallback(async () => {
    setLoad('loading');
    try {
      const list = await api.list();
      setProperties(list);
      setSelectedId((current) => {
        const next = list.some((p) => p.id === current) ? current : (list[0]?.id ?? null);
        storeSelection(next);
        return next;
      });
      setLoad('ready');
    } catch {
      setLoad('error');
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = properties.find((p) => p.id === selectedId) ?? null;

  async function save(values: PropertyFormValues) {
    if (mode === 'edit' && selected) {
      const updated = await api.update(selected.id, values);
      setProperties((list) => list.map((p) => (p.id === updated.id ? updated : p)));
      select(updated.id);
    } else {
      const created = await api.create(values);
      setProperties((list) => [...list, created]);
      select(created.id);
    }
    setMode('view');
  }

  async function confirmDelete() {
    if (!selected) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.remove(selected.id);
      const remaining = properties.filter((p) => p.id !== selected.id);
      setProperties(remaining);
      select(remaining[0]?.id ?? null);
      setDeleting(false);
    } catch {
      setDeleteError('Deleting failed. Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  }

  function renderMain() {
    if (load === 'loading') {
      return (
        <p role="status" className="py-12 text-center text-slate-600">
          Loading properties...
        </p>
      );
    }
    if (load === 'error') {
      return (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800">The properties could not be loaded.</p>
          <button type="button" onClick={() => void reload()} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      );
    }
    if (mode === 'add' || (mode === 'edit' && !selected)) {
      return (
        <PropertyForm
          title="Add property"
          submitLabel="Add property"
          initial={emptyValues}
          onSubmit={save}
          onCancel={() => setMode('view')}
        />
      );
    }
    if (mode === 'edit' && selected) {
      return (
        <PropertyForm
          key={selected.id}
          title="Edit property"
          submitLabel="Save changes"
          initial={valuesFromProperty(selected)}
          onSubmit={save}
          onCancel={() => setMode('view')}
        />
      );
    }
    if (!selected) return <EmptyState onAdd={() => setMode('add')} />;
    return (
      <div className="space-y-6">
        <PropertySwitcher
          properties={properties}
          selectedId={selectedId}
          onSelect={select}
          onAdd={() => setMode('add')}
        />
        <PropertyDetails
          property={selected}
          onEdit={() => setMode('edit')}
          onDelete={() => {
            setDeleteError(null);
            setDeleting(true);
          }}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Home Maintenance Log</h1>
        <span data-testid="api-status" className={`rounded px-2 py-1 text-sm ${statusStyle[status]}`}>
          API: {status}
        </span>
      </header>
      <div className="mt-8">{renderMain()}</div>
      {deleting && selected && (
        <ConfirmDeleteDialog
          property={selected}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(false)}
        />
      )}
      {version !== undefined && (
        <footer data-testid="app-version" className="mt-8 break-words text-sm text-slate-600">
          Version {version ?? 'unknown'}
        </footer>
      )}
    </main>
  );
}
