import { useEffect, useRef, useState } from 'react';

interface Props {
  email: string;
  propertyCount: number;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CONFIRM_WORD = 'DELETE';

/** Native modal dialog: the browser traps focus, restores it on close and Escape fires the cancel event. */
export function DeleteAccountDialog({ email, propertyCount, busy, error, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const properties =
    propertyCount === 0
      ? 'You have no properties, so no properties will be deleted.'
      : `All of your properties (${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}) will be permanently deleted.`;

  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-account-title"
      aria-describedby="delete-account-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl p-0 shadow-xl backdrop:bg-slate-900/50"
    >
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim() === CONFIRM_WORD && !busy) onConfirm();
        }}
      >
        <h2 id="delete-account-title" className="text-lg font-semibold text-slate-900">
          Delete account
        </h2>
        <div id="delete-account-description" className="mt-2 space-y-2 text-slate-600">
          <p>
            The account <strong className="break-all font-semibold">{email}</strong> will be permanently deleted.
          </p>
          <p>{properties}</p>
          <p className="font-semibold text-slate-900">This cannot be undone.</p>
        </div>
        <label htmlFor="delete-account-confirm" className="mt-4 block text-sm font-medium text-slate-900">
          Type {CONFIRM_WORD} to confirm
        </label>
        <input
          id="delete-account-confirm"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={busy || typed.trim() !== CONFIRM_WORD} className="btn-danger-solid">
            {busy ? 'Deleting...' : 'Delete account'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
