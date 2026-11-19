import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from './api';
import { AuthGate } from './AuthGate';

const user: User = { id: 'u1', email: 'anna@example.com', name: 'Anna Test' };

beforeEach(() => localStorage.clear());

// The signed-in app talks to the real fetch for health and version; stub it out.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) =>
      path === '/api/properties'
        ? new Response('[]')
        : path.includes('version')
          ? new Response(JSON.stringify({ version: '1.0.0' }))
          : new Response(JSON.stringify({ status: 'ok' })),
    ),
  );
});

describe('AuthGate', () => {
  it('shows the Google button and no property data without a session', async () => {
    render(<AuthGate loadMe={async () => null} loadMode={async () => 'google'} authFailed={false} />);
    const link = await screen.findByRole('link', { name: 'Sign in with Google' });
    expect(link).toHaveAttribute('href', '/api/auth/login');
    expect(screen.getByRole('heading', { name: 'Home Maintenance Log' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test sign-in' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Loading properties/)).not.toBeInTheDocument();
  });

  it('shows the labelled test sign-in and no Google button in test mode', async () => {
    render(<AuthGate loadMe={async () => null} loadMode={async () => 'test'} authFailed={false} />);
    expect(await screen.findByRole('button', { name: 'Test sign-in' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Google/ })).not.toBeInTheDocument();
  });

  it('shows a message when sign-in did not complete', async () => {
    render(<AuthGate loadMe={async () => null} loadMode={async () => 'google'} authFailed />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in did not complete');
  });

  it('shows the app after the test sign-in', async () => {
    const userEv = userEvent.setup();
    let signedIn = false;
    const doTestSignIn = vi.fn(async () => {
      signedIn = true;
    });
    render(
      <AuthGate
        loadMe={async () => (signedIn ? user : null)}
        loadMode={async () => 'test'}
        doTestSignIn={doTestSignIn}
        authFailed={false}
      />,
    );
    await userEv.click(await screen.findByRole('button', { name: 'Test sign-in' }));
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByTestId('signed-in-user')).toHaveTextContent('Anna Test');
  });

  it('shows the app when a session exists', async () => {
    render(<AuthGate loadMe={async () => user} loadMode={async () => 'google'} authFailed={false} />);
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in with Google' })).not.toBeInTheDocument();
  });

  it('offers a retry when the API cannot be reached', async () => {
    render(
      <AuthGate
        loadMe={async () => {
          throw new Error('offline');
        }}
        loadMode={async () => 'google'}
        authFailed={false}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
  });

  it('signs out on the server, clears the selection and leaves the page', async () => {
    const userEv = userEvent.setup();
    localStorage.setItem('selectedPropertyId', 'p1');
    const doSignOut = vi.fn(async () => undefined);
    const leave = vi.fn();
    render(
      <AuthGate
        loadMe={async () => user}
        loadMode={async () => 'google'}
        doSignOut={doSignOut}
        leave={leave}
        authFailed={false}
      />,
    );
    await userEv.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(doSignOut).toHaveBeenCalledOnce();
    expect(leave).toHaveBeenCalledOnce();
    expect(localStorage.getItem('selectedPropertyId')).toBeNull();
  });

  it('returns to the login screen when the API answers 401 during use', async () => {
    let signedIn = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/properties') {
          signedIn = false;
          return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
        }
        return new Response(JSON.stringify({ status: 'ok', version: '1' }));
      }),
    );
    render(<AuthGate loadMe={async () => (signedIn ? user : null)} loadMode={async () => 'google'} authFailed={false} />);
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(screen.queryByText('The properties could not be loaded.')).not.toBeInTheDocument();
  });
});
