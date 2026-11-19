import { useCallback, useEffect, useState } from 'react';
import { App } from './App';
import {
  fetchMe,
  fetchSignInMode,
  signOut,
  type SignInMode,
  testSignIn,
  type User,
} from './api';
import { LoginScreen } from './components/LoginScreen';

const SELECTED_KEY = 'selectedPropertyId';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'signed-out'; mode: SignInMode }
  | { kind: 'signed-in'; user: User };

function clearSelection() {
  try {
    localStorage.removeItem(SELECTED_KEY);
  } catch {
    // Storage can be unavailable (private mode); there is then nothing to clear.
  }
}

/** Shows the login screen until the API confirms a session, then the app. */
export function AuthGate({
  loadMe = fetchMe,
  loadMode = fetchSignInMode,
  doTestSignIn = testSignIn,
  doSignOut = signOut,
  authFailed = new URLSearchParams(window.location.search).has('auth_error'),
  leave = () => window.location.replace('/'),
}: {
  loadMe?: () => Promise<User | null>;
  loadMode?: () => Promise<SignInMode>;
  doTestSignIn?: () => Promise<void>;
  doSignOut?: () => Promise<void>;
  authFailed?: boolean;
  /** Full navigation after sign-out, so the back button cannot bring cached data back. */
  leave?: () => void;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const check = useCallback(async () => {
    try {
      const user = await loadMe();
      setState(user ? { kind: 'signed-in', user } : { kind: 'signed-out', mode: await loadMode() });
    } catch {
      setState({ kind: 'error' });
    }
  }, [loadMe, loadMode]);

  useEffect(() => {
    void check();
  }, [check]);

  // A page restored from the back/forward cache must re-check the session.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  useEffect(() => {
    if (authFailed) window.history.replaceState(null, '', window.location.pathname);
  }, [authFailed]);

  const onUnauthorized = useCallback(() => {
    clearSelection();
    setState((s) => (s.kind === 'signed-in' ? { kind: 'loading' } : s));
    void check();
  }, [check]);

  const onSignOut = useCallback(async () => {
    try {
      await doSignOut();
    } finally {
      clearSelection();
      leave();
    }
  }, [doSignOut, leave]);

  if (state.kind === 'loading') {
    return (
      <p role="status" className="py-12 text-center text-slate-600">
        Loading...
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <div role="alert" className="mx-auto mt-12 max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-800">The server could not be reached.</p>
        <button type="button" onClick={() => void check()} className="btn-secondary mt-4">
          Retry
        </button>
      </div>
    );
  }
  if (state.kind === 'signed-out') {
    return (
      <LoginScreen
        mode={state.mode}
        failed={authFailed}
        onTestSignIn={async () => {
          await doTestSignIn();
          await check();
        }}
      />
    );
  }
  return <App user={state.user} onSignOut={onSignOut} onUnauthorized={onUnauthorized} />;
}
