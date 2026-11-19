import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, deleteAccount, type Property, type PropertiesApi, type User } from './api';
import { App } from './App';
import { AuthGate } from './AuthGate';

const user: User = { id: 'u1', email: 'anna@example.com', name: 'Anna Test' };

const property = (id: string): Property => ({
  id,
  displayName: null,
  street: `Straat ${id}`,
  houseNumber: '1',
  houseNumberAddition: '',
  postalCode: '1234 AB',
  city: 'Teststad',
  country: 'NL',
  ownerName: 'Anna Test',
  propertyType: null,
  yearBuilt: null,
  livingAreaM2: null,
  rooms: null,
  notes: null,
});

const apiWith = (rows: Property[]): PropertiesApi => ({
  list: vi.fn(async () => rows),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
});

const ok = async () => 'ok' as const;

async function openAccount(rows: Property[], doDeleteAccount = vi.fn(async () => undefined), extra = {}) {
  const u = userEvent.setup();
  render(
    <App
      loadHealth={ok}
      loadVersion={async () => null}
      api={apiWith(rows)}
      user={user}
      onSignOut={() => undefined}
      doDeleteAccount={doDeleteAccount}
      {...extra}
    />,
  );
  await screen.findByRole('button', { name: 'Sign out' });
  await u.click(screen.getByTestId('signed-in-user'));
  return { u, doDeleteAccount };
}

async function openDialog(u: ReturnType<typeof userEvent.setup>) {
  const button = await screen.findByRole('button', { name: 'Delete account' });
  await vi.waitFor(() => expect(button).toBeEnabled());
  await u.click(button);
  return screen.getByRole('dialog');
}

beforeEach(() => localStorage.clear());

describe('Account view', () => {
  it('shows name, email, a way back and a danger zone, and deletes nothing by itself', async () => {
    const { doDeleteAccount } = await openAccount([property('a')]);
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByText('Name').nextElementSibling).toHaveTextContent('Anna Test');
    expect(screen.getByText('anna@example.com')).toBeInTheDocument();
    const zone = screen.getByRole('region', { name: 'Danger zone' });
    expect(within(zone).getByText(/permanent.*all of its properties/)).toBeInTheDocument();
    expect(within(zone).getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(doDeleteAccount).not.toHaveBeenCalled();
  });

  it('goes back to the properties', async () => {
    const { u } = await openAccount([property('a')]);
    await u.click(screen.getByRole('button', { name: 'Back to properties' }));
    expect(await screen.findByRole('heading', { name: 'Straat a 1' })).toBeInTheDocument();
  });
});

describe('Delete account dialog', () => {
  it('names the email and the number of properties and says it cannot be undone', async () => {
    const { u } = await openAccount([property('a'), property('b'), property('c')]);
    const dialog = await openDialog(u);
    expect(within(dialog).getByRole('heading', { name: 'Delete account' })).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(/anna@example\.com.*3 properties.*permanently deleted.*cannot be undone/s);
  });

  it('still states the permanent deletion when there are no properties', async () => {
    const { u } = await openAccount([]);
    const dialog = await openDialog(u);
    expect(dialog).toHaveTextContent('permanently deleted');
    expect(dialog).toHaveTextContent('no properties will be deleted');
    expect(dialog).toHaveTextContent('This cannot be undone');
  });

  it('keeps the confirm button disabled until DELETE is typed exactly, ignoring surrounding spaces', async () => {
    const { u } = await openAccount([property('a')]);
    const dialog = await openDialog(u);
    const confirm = within(dialog).getByRole('button', { name: 'Delete account' });
    const field = within(dialog).getByLabelText(/Type DELETE/);
    expect(confirm).toBeDisabled();
    await u.type(field, 'delete');
    expect(confirm).toBeDisabled();
    await u.clear(field);
    await u.type(field, 'DELETE now');
    expect(confirm).toBeDisabled();
    await u.clear(field);
    await u.type(field, '  DELETE ');
    expect(confirm).toBeEnabled();
  });

  it('closes on Cancel and on Escape without deleting', async () => {
    const { u, doDeleteAccount } = await openAccount([property('a')]);
    let dialog = await openDialog(u);
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    dialog = await openDialog(u);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(doDeleteAccount).not.toHaveBeenCalled();
  });

  it('shows Deleting..., disables both buttons and sends one request', async () => {
    let finish: () => void = () => undefined;
    const doDelete = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { u } = await openAccount([property('a')], doDelete);
    const dialog = await openDialog(u);
    await u.type(within(dialog).getByLabelText(/Type DELETE/), 'DELETE');
    await u.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    expect(within(dialog).getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await u.click(within(dialog).getByRole('button', { name: 'Deleting...' }));
    expect(doDelete).toHaveBeenCalledTimes(1);
    finish();
  });

  it('stays open with an error when the deletion fails, and allows a retry', async () => {
    const doDelete = vi.fn().mockRejectedValueOnce(new ApiError('boom', 500)).mockResolvedValue(undefined);
    const onAccountDeleted = vi.fn();
    const { u } = await openAccount([property('a')], doDelete, { onAccountDeleted });
    const dialog = await openDialog(u);
    await u.type(within(dialog).getByLabelText(/Type DELETE/), 'DELETE');
    await u.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nothing was deleted');
    expect(onAccountDeleted).not.toHaveBeenCalled();
    const retry = within(dialog).getByRole('button', { name: 'Delete account' });
    expect(retry).toBeEnabled();
    await u.click(retry);
    await vi.waitFor(() => expect(onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(doDelete).toHaveBeenCalledTimes(2);
  });
});

describe('after the account is deleted', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) =>
        path === '/api/properties'
          ? new Response(JSON.stringify([property('a')]))
          : path.includes('version')
            ? new Response(JSON.stringify({ version: '1.0.0' }))
            : new Response(JSON.stringify({ status: 'ok' })),
      ),
    );
  });

  it('shows the login screen with the message and forgets the selected property', async () => {
    localStorage.setItem('selectedPropertyId', 'a');
    const u = userEvent.setup();
    let signedIn = true;
    render(
      <AuthGate
        loadMe={async () => (signedIn ? user : null)}
        loadMode={async () => 'test'}
        doDeleteAccount={async () => {
          signedIn = false;
        }}
        authFailed={false}
      />,
    );
    await u.click(await screen.findByTestId('signed-in-user'));
    const dialog = await openDialog(u);
    await u.type(within(dialog).getByLabelText(/Type DELETE/), 'DELETE');
    await u.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    expect(await screen.findByText('Your account has been deleted.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test sign-in' })).toBeInTheDocument();
    expect(localStorage.getItem('selectedPropertyId')).toBeNull();
  });
});

describe('deleteAccount api call', () => {
  it('sends the typed confirmation and treats 204 as success', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    await deleteAccount(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/auth/account',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),
    );
  });

  it('throws on a server error', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 500 }));
    await expect(deleteAccount(fetchFn as unknown as typeof fetch)).rejects.toBeInstanceOf(ApiError);
  });
});
