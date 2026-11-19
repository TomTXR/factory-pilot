import { useState } from 'react';
import type { SignInMode } from '../api';

export function LoginScreen({
  mode,
  failed,
  onTestSignIn,
}: {
  mode: SignInMode;
  /** True when Google sign-in did not complete. */
  failed: boolean;
  onTestSignIn: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [testError, setTestError] = useState(false);

  async function testSignIn() {
    setBusy(true);
    setTestError(false);
    try {
      await onTestSignIn();
    } catch {
      setTestError(true);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12 text-center sm:px-6 sm:py-20">
      <h1 className="text-2xl font-semibold text-slate-900">Home Maintenance Log</h1>
      <p className="mt-3 text-slate-600">Sign in to see your properties.</p>
      {(failed || testError) && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
          Sign-in did not complete. Please try again.
        </p>
      )}
      <div className="mt-8">
        {mode === 'google' ? (
          // A plain link: Google opens in the same tab, which also works on phones.
          <a href="/api/auth/login" className="btn-primary w-full">
            Sign in with Google
          </a>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => void testSignIn()} className="btn-primary w-full">
              Test sign-in
            </button>
            <p className="mt-3 text-sm text-slate-600">
              Test environment only: signs in as a synthetic test user, not with Google.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
