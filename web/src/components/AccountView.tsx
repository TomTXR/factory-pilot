import { useState } from 'react';
import type { User } from '../api';
import { DeleteAccountDialog } from './DeleteAccountDialog';

interface Props {
  user: User;
  /** Null while the property list is not loaded: the dialog needs the number. */
  propertyCount: number | null;
  onBack: () => void;
  /** Rejects when the deletion failed. */
  onDeleteAccount: () => Promise<void>;
}

export function AccountView({ user, propertyCount, onBack, onDeleteAccount }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onDeleteAccount();
    } catch {
      setError('Deleting the account failed. Nothing was deleted. Please try again.');
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="account-title" className="space-y-8">
      <div>
        <button type="button" onClick={onBack} className="btn-secondary">
          Back to properties
        </button>
      </div>
      <div>
        <h2 id="account-title" className="text-xl font-semibold text-slate-900">
          Account
        </h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-slate-600">Name</dt>
            <dd className="break-words text-slate-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Email</dt>
            <dd className="break-all text-slate-900">{user.email}</dd>
          </div>
        </dl>
      </div>
      <section aria-labelledby="danger-title" className="rounded-xl border-2 border-red-300 p-4 sm:p-6">
        <h3 id="danger-title" className="text-lg font-semibold text-red-800">
          Danger zone
        </h3>
        <p className="mt-2 text-slate-700">
          Deleting your account is permanent. It removes the account and all of its properties.
        </p>
        <button
          type="button"
          disabled={propertyCount === null}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="btn-danger mt-4"
        >
          Delete account
        </button>
      </section>
      {open && propertyCount !== null && (
        <DeleteAccountDialog
          email={user.email}
          propertyCount={propertyCount}
          busy={busy}
          error={error}
          onConfirm={() => void confirm()}
          onCancel={() => setOpen(false)}
        />
      )}
    </section>
  );
}
