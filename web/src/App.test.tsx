import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Property, type PropertiesApi, type PropertyFormValues } from './api';
import { App } from './App';

function property(over: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    displayName: null,
    street: 'Teststraat',
    houseNumber: '12',
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
    ...over,
  };
}

function fakeApi(initial: Property[] = []): PropertiesApi {
  let rows = [...initial];
  return {
    list: vi.fn(async () => rows),
    create: vi.fn(async (v: PropertyFormValues) => {
      const created = property({
        id: `n${rows.length + 1}`,
        ...v,
        displayName: v.displayName || null,
        propertyType: v.propertyType === '' ? null : v.propertyType,
        yearBuilt: v.yearBuilt ? Number(v.yearBuilt) : null,
        livingAreaM2: null,
        rooms: null,
        notes: v.notes || null,
      });
      rows = [...rows, created];
      return created;
    }),
    update: vi.fn(async (id: string, v: PropertyFormValues) => {
      const updated = property({
        id,
        ...v,
        displayName: v.displayName || null,
        propertyType: v.propertyType === '' ? null : v.propertyType,
        yearBuilt: null,
        livingAreaM2: null,
        rooms: null,
        notes: v.notes || null,
      });
      rows = rows.map((p) => (p.id === id ? updated : p));
      return updated;
    }),
    remove: vi.fn(async (id: string) => {
      rows = rows.filter((p) => p.id !== id);
    }),
  };
}

const ok = async () => 'ok' as const;

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Street/), 'Hauptstrasse');
  await user.type(screen.getByLabelText(/^House number/), '5');
  await user.type(screen.getByLabelText(/^Postal code/), '10115');
  await user.type(screen.getByLabelText(/^City/), 'Berlin');
  await user.type(screen.getByLabelText(/^Owner name/), 'Ben Test');
}

beforeEach(() => localStorage.clear());

describe('App', () => {
  it('shows the title and the API status', async () => {
    render(<App loadHealth={ok} api={fakeApi()} />);
    expect(screen.getByRole('heading', { name: 'Home Maintenance Log' })).toBeInTheDocument();
    expect(await screen.findByText('API: ok')).toBeInTheDocument();
  });

  it('shows who is signed in and signs out on request', async () => {
    const onSignOut = vi.fn();
    render(
      <App
        loadHealth={ok}
        api={fakeApi()}
        user={{ id: 'u1', email: 'a@example.com', name: 'Anna Test' }}
        onSignOut={onSignOut}
      />,
    );
    expect(screen.getByText('Anna Test')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('has no sign-out control without a user', () => {
    render(<App loadHealth={ok} api={fakeApi()} />);
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('reports a 401 from the API instead of showing an error', async () => {
    const onUnauthorized = vi.fn();
    const api = fakeApi();
    api.list = vi.fn(async () => {
      throw new ApiError('You are not signed in.', 401);
    });
    render(<App loadHealth={ok} api={api} onUnauthorized={onUnauthorized} />);
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
  });

  it('shows the version in the footer', async () => {
    render(<App loadHealth={ok} loadVersion={async () => '1.2.3'} api={fakeApi()} />);
    expect(await screen.findByText('Version 1.2.3')).toBeInTheDocument();
  });

  it('shows Version unknown when the version is unavailable', async () => {
    render(<App loadHealth={ok} loadVersion={async () => null} api={fakeApi()} />);
    expect(await screen.findByText('Version unknown')).toBeInTheDocument();
  });

  it('shows no version while it is loading', () => {
    render(<App loadHealth={ok} loadVersion={() => new Promise(() => {})} api={fakeApi()} />);
    expect(screen.queryByTestId('app-version')).not.toBeInTheDocument();
  });

  it('shows unreachable when the API cannot be reached', async () => {
    render(<App loadHealth={async () => 'unreachable'} api={fakeApi()} />);
    expect(await screen.findByText('API: unreachable')).toBeInTheDocument();
  });

  it('shows the add-first call to action when there are no properties', async () => {
    render(<App loadHealth={ok} api={fakeApi()} />);
    expect(await screen.findByRole('button', { name: 'Add your first property' })).toBeInTheDocument();
    expect(screen.queryByText('No properties yet.')).not.toBeInTheDocument();
  });

  it('adds the first property, selects it and shows its data', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    render(<App loadHealth={ok} api={api} />);
    await user.click(await screen.findByRole('button', { name: 'Add your first property' }));
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText('Country'), 'DE');
    await user.click(screen.getByRole('button', { name: 'Add property' }));

    expect(await screen.findByRole('heading', { name: 'Hauptstrasse 5' })).toBeInTheDocument();
    expect(screen.getByText('Ben Test')).toBeInTheDocument();
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ country: 'DE', street: 'Hauptstrasse' }));
    expect(localStorage.getItem('selectedPropertyId')).toBe('n1');
  });

  it('shows inline field errors from the API and keeps the typed values', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.create = vi.fn().mockRejectedValue(new ApiError('Please correct the highlighted fields.', 400, { city: 'City is required' }));
    render(<App loadHealth={ok} api={api} />);
    await user.click(await screen.findByRole('button', { name: 'Add your first property' }));
    await user.type(screen.getByLabelText(/^Street/), 'Hauptstrasse');
    await user.click(screen.getByRole('button', { name: 'Add property' }));

    expect(await screen.findByText('City is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/^City/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Street/)).toHaveValue('Hauptstrasse');
  });

  it('shows "This property already exists" on a duplicate', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    api.create = vi.fn().mockRejectedValue(new ApiError('This property already exists', 409));
    render(<App loadHealth={ok} api={api} />);
    await user.click(await screen.findByRole('button', { name: 'Add your first property' }));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add property' }));
    expect(await screen.findByText('This property already exists')).toBeInTheDocument();
  });

  it('keeps the entered data and allows a retry when saving fails', async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    const create = api.create;
    api.create = vi.fn().mockRejectedValueOnce(new ApiError('The server could not be reached.', null)).mockImplementation(create);
    render(<App loadHealth={ok} api={api} />);
    await user.click(await screen.findByRole('button', { name: 'Add your first property' }));
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Add property' }));
    expect(await screen.findByText(/could not be reached/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^City/)).toHaveValue('Berlin');
    await user.click(screen.getByRole('button', { name: 'Add property' }));
    expect(await screen.findByRole('heading', { name: 'Hauptstrasse 5' })).toBeInTheDocument();
  });

  it('shows an error with a retry button when loading fails', async () => {
    const user = userEvent.setup();
    const api = fakeApi([property()]);
    api.list = vi.fn().mockRejectedValueOnce(new ApiError('x', null)).mockResolvedValue([property()]);
    render(<App loadHealth={ok} api={api} />);
    expect(await screen.findByText('The properties could not be loaded.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Teststraat 12' })).toBeInTheDocument();
  });

  it('selects the first property by default and restores the stored selection', async () => {
    const rows = [property(), property({ id: 'p2', displayName: 'Holiday home', ownerName: 'Zoe' })];
    localStorage.setItem('selectedPropertyId', 'p2');
    const { unmount } = render(<App loadHealth={ok} api={fakeApi(rows)} />);
    expect(await screen.findByRole('heading', { name: 'Holiday home' })).toBeInTheDocument();
    unmount();

    localStorage.setItem('selectedPropertyId', 'gone');
    render(<App loadHealth={ok} api={fakeApi(rows)} />);
    expect(await screen.findByRole('heading', { name: 'Teststraat 12' })).toBeInTheDocument();
  });

  it('switches between properties and shows only filled-in characteristics', async () => {
    const user = userEvent.setup();
    const rows = [
      property(),
      property({ id: 'p2', displayName: 'Holiday home', ownerName: 'Zoe', yearBuilt: 1980, rooms: 3, propertyType: 'apartment' }),
    ];
    render(<App loadHealth={ok} api={fakeApi(rows)} />);
    await screen.findByRole('heading', { name: 'Teststraat 12' });
    expect(screen.queryByText('Year built')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Property'), 'p2');
    expect(screen.getByRole('heading', { name: 'Holiday home' })).toBeInTheDocument();
    expect(screen.getByText('1980')).toBeInTheDocument();
    expect(screen.getByText('Apartment')).toBeInTheDocument();
    expect(screen.queryByText('Living area')).not.toBeInTheDocument();
    expect(localStorage.getItem('selectedPropertyId')).toBe('p2');
  });

  it('offers "Add property" when properties exist', async () => {
    const user = userEvent.setup();
    render(<App loadHealth={ok} api={fakeApi([property()])} />);
    await user.click(await screen.findByRole('button', { name: 'Add property' }));
    expect(screen.getByRole('heading', { name: 'Add property' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Teststraat 12' })).toBeInTheDocument();
  });

  it('edits the selected property with a prefilled form', async () => {
    const user = userEvent.setup();
    const api = fakeApi([property()]);
    render(<App loadHealth={ok} api={api} />);
    await user.click(await screen.findByRole('button', { name: 'Edit property' }));
    const city = screen.getByLabelText(/^City/);
    expect(city).toHaveValue('Teststad');
    await user.clear(city);
    await user.type(city, 'Nieuwstad');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Nieuwstad/)).toBeInTheDocument();
    expect(api.update).toHaveBeenCalledWith('p1', expect.objectContaining({ city: 'Nieuwstad' }));
  });

  it('asks for confirmation before deleting and does nothing on cancel', async () => {
    const user = userEvent.setup();
    const api = fakeApi([property()]);
    render(<App loadHealth={ok} api={api} />);
    await user.click(await screen.findByRole('button', { name: 'Delete property' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Teststraat 12')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.remove).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes after confirmation, selects another property, then shows the empty state', async () => {
    const user = userEvent.setup();
    const rows = [property(), property({ id: 'p2', displayName: 'Holiday home', ownerName: 'Zoe' })];
    const api = fakeApi(rows);
    render(<App loadHealth={ok} api={api} />);
    await screen.findByRole('heading', { name: 'Teststraat 12' });

    await user.click(screen.getByRole('button', { name: 'Delete property' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'Holiday home' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete property' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('button', { name: 'Add your first property' })).toBeInTheDocument();
  });

  it('shows an error in the dialog when deleting fails', async () => {
    const user = userEvent.setup();
    const api = fakeApi([property()]);
    api.remove = vi.fn().mockRejectedValue(new ApiError('x', 500));
    render(<App loadHealth={ok} api={api} />);
    await user.click(await screen.findByRole('button', { name: 'Delete property' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleting failed. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
