import { useEffect, useRef } from 'react';
import { type Property, propertyLabel } from '../api';

interface Props {
  property: Property;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native modal dialog: the browser traps focus and Escape fires the cancel event. */
export function ConfirmDeleteDialog({ property, busy, error, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="p-6">
        <h2 id="delete-title" className="text-lg font-semibold text-slate-900">
          Delete property
        </h2>
        <p id="delete-description" className="mt-2 text-slate-600">
          Delete <strong className="font-semibold">{propertyLabel(property)}</strong> permanently? This cannot be
          undone.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="btn-danger-solid">
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
