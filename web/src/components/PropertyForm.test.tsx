import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type Address, type AddressApi, ApiError, type RefreshOutcome } from '../api';
import { emptyValues, PropertyForm } from './PropertyForm';

const ADDRESS: Address = {
  street: 'Voorbeeldstraat',
  houseNumber: '12',
  houseNumberAddition: 'A',
  postalCode: '9999 SS',
  city: 'Testdorp',
};

function fakeApi(over: Partial<AddressApi> = {}): AddressApi {
  return {
    suggest: vi.fn(async () => ({
      status: 'ok' as const,
      suggestions: [
        { id: 'adr-1', label: 'Voorbeeldstraat 12A, 9999 SS Testdorp' },
        { id: 'adr-2', label: 'Voorbeeldstraat 14, 9999 SS Testdorp' },
      ],
    })),
    lookupById: vi.fn(async () => ({ status: 'found' as const, address: ADDRESS })),
    refresh: vi.fn(async (): Promise<RefreshOutcome> => ({ status: 'found', address: ADDRESS })),
    ...over,
  };
}

function setup(addressApi: AddressApi, props: { refresh?: boolean; initial?: Partial<typeof emptyValues> } = {}) {
  const onSubmit = vi.fn(async () => {});
  const user = userEvent.setup();
  render(
    <PropertyForm
      title="Add property"
      submitLabel="Add property"
      initial={{ ...emptyValues, ...props.initial }}
      onSubmit={onSubmit}
      onCancel={() => {}}
      refresh={props.refresh}
      addressApi={addressApi}
    />,
  );
  return { user, onSubmit };
}

const search = () => screen.getByRole('combobox', { name: 'Find address' });
const value = (label: RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;

async function searchAndPick(user: ReturnType<typeof userEvent.setup>, text = 'voorbeeld 12') {
  await user.type(search(), text);
  await user.click(await screen.findByRole('option', { name: /12A/ }));
}

describe('PropertyForm address search', () => {
  it('#59 AC1: asks for the country before the address fields', () => {
    setup(fakeApi());
    const labels = screen.getAllByText(/^(Display name|Country|Find address|Street|House number|Postal code|City|Owner name)/, {
      selector: 'label',
    });
    expect(labels.map((l) => l.textContent?.replace(/ \(required\)/, ''))).toEqual([
      'Display name',
      'Country',
      'Find address',
      'Street',
      'House number',
      'Postal code',
      'City',
      'Owner name',
    ]);
    expect(screen.getByLabelText('Country')).toHaveValue('NL');
  });

  it('#59 AC2: hides the search and the lookup button for Germany without sending requests and keeps the fields', async () => {
    const api = fakeApi();
    const { user } = setup(api, { refresh: true, initial: { street: 'Alte Strasse' } });
    expect(screen.getByRole('button', { name: 'Look up in BAG' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Country'), 'DE');
    expect(screen.queryByLabelText('Find address')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Look up in BAG' })).not.toBeInTheDocument();
    expect(value(/^Street/)).toBe('Alte Strasse');
    expect(api.suggest).not.toHaveBeenCalled();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('#59 AC3: does not search for fewer than 3 characters', async () => {
    const api = fakeApi();
    const { user } = setup(api);
    await user.type(search(), 'vo');
    await new Promise((r) => setTimeout(r, 450));
    expect(api.suggest).not.toHaveBeenCalled();
  });

  it('#59 AC4: fills and marks all address fields when a suggestion is picked, and the mouse and keys both work', async () => {
    const api = fakeApi();
    const { user } = setup(api);
    await searchAndPick(user);
    expect(api.lookupById).toHaveBeenCalledWith('adr-1');
    await waitFor(() => expect(value(/^Street/)).toBe('Voorbeeldstraat'));
    expect(value(/^House number/)).toBe('12');
    expect(value(/^Addition/)).toBe('A');
    expect(value(/^Postal code/)).toBe('9999 SS');
    expect(value(/^City/)).toBe('Testdorp');
    expect(screen.getAllByText('From BAG')).toHaveLength(5);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('#59 AC4: picks with the arrow keys and Enter without submitting the form, and Escape closes the list', async () => {
    const api = fakeApi();
    const { user, onSubmit } = setup(api);
    await user.type(search(), 'voorbeeld');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(api.lookupById).not.toHaveBeenCalled();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(api.lookupById).toHaveBeenCalledWith('adr-2'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('#59 AC8: removes the marker of a field changed by hand', async () => {
    const { user } = setup(fakeApi());
    await searchAndPick(user);
    await waitFor(() => expect(screen.getAllByText('From BAG')).toHaveLength(5));
    await user.type(screen.getByLabelText(/^City/), 'x');
    expect(screen.getAllByText('From BAG')).toHaveLength(4);
  });

  it('#59 AC7: saves a property filled in by hand without using the search', async () => {
    const api = fakeApi();
    const { user, onSubmit } = setup(api);
    await user.type(screen.getByLabelText(/^Street/), 'Eigenstraat');
    await user.type(screen.getByLabelText(/^House number/), '3');
    await user.type(screen.getByLabelText(/^Postal code/), '1011 AB');
    await user.type(screen.getByLabelText(/^City/), 'Eigenstad');
    await user.type(screen.getByLabelText(/^Owner name/), 'Anna Test');
    await user.click(screen.getByRole('button', { name: 'Add property' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ street: 'Eigenstraat', houseNumber: '3', postalCode: '1011 AB', city: 'Eigenstad' }),
    );
    expect(api.suggest).not.toHaveBeenCalled();
    expect(api.lookupById).not.toHaveBeenCalled();
    expect(screen.queryByText('From BAG')).not.toBeInTheDocument();
  });

  it('#59 AC9: saves exactly the values shown, including corrections', async () => {
    const { user, onSubmit } = setup(fakeApi());
    await searchAndPick(user);
    await waitFor(() => expect(value(/^City/)).toBe('Testdorp'));
    await user.clear(screen.getByLabelText(/^City/));
    await user.type(screen.getByLabelText(/^City/), 'Anderdorp');
    await user.type(screen.getByLabelText(/^Owner name/), 'Anna Test');
    await user.click(screen.getByRole('button', { name: 'Add property' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ street: 'Voorbeeldstraat', postalCode: '9999 SS', city: 'Anderdorp', ownerName: 'Anna Test' }),
    );
  });

  it('#59 AC5: shows the answer for the latest text only', async () => {
    let resolveFirst: (v: Awaited<ReturnType<AddressApi['suggest']>>) => void = () => {};
    const suggest = vi
      .fn<AddressApi['suggest']>()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockImplementation(async () => ({ status: 'ok', suggestions: [{ id: 'adr-9', label: 'Nieuwe 1, 9999 SS Testdorp' }] }));
    const { user } = setup(fakeApi({ suggest }));
    await user.type(search(), 'abc');
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(1));
    await user.type(search(), 'd');
    await screen.findByRole('option', { name: /Nieuwe 1/ });
    resolveFirst({ status: 'ok', suggestions: [{ id: 'adr-0', label: 'Oude 1, 9999 SS Testdorp' }] });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('option', { name: /Oude 1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Nieuwe 1/ })).toBeInTheDocument();
  });

  it('#59 AC5: does not overwrite a field changed while the picked address loads', async () => {
    let resolve: (v: { status: 'found'; address: Address }) => void = () => {};
    const api = fakeApi({ lookupById: () => new Promise((r) => (resolve = r)) });
    const { user } = setup(api);
    await searchAndPick(user);
    expect(await screen.findByText('Loading the address...')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Street/), 'Mijn straat');
    resolve({ status: 'found', address: ADDRESS });
    await waitFor(() => expect(value(/^City/)).toBe('Testdorp'));
    expect(value(/^Street/)).toBe('Mijn straat');
    expect(screen.getAllByText('From BAG')).toHaveLength(4);
  });

  it('#59 AC6: tells when nothing matches and changes no field', async () => {
    const { user } = setup(fakeApi({ suggest: async () => ({ status: 'ok', suggestions: [] }) }), { initial: { street: 'Eigen' } });
    await user.type(search(), 'zzzz');
    expect(await screen.findByText('No matching address found. You can fill in the fields yourself.')).toBeInTheDocument();
    expect(value(/^Street/)).toBe('Eigen');
  });

  it('#59 AC10: shows a failure for the search and for a picked address and changes no field', async () => {
    const { user } = setup(fakeApi({ suggest: async () => ({ status: 'unavailable' }) }), { initial: { city: 'Eigen' } });
    await user.type(search(), 'voorbeeld');
    expect(await screen.findByRole('alert')).toHaveTextContent('The address search is not available right now');
    expect(value(/^City/)).toBe('Eigen');
  });

  it('#59 AC10: shows a failure when loading the picked address fails', async () => {
    const { user } = setup(fakeApi({ lookupById: async () => ({ status: 'unavailable' }) }), { initial: { city: 'Eigen' } });
    await searchAndPick(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('The address search is not available right now');
    expect(value(/^City/)).toBe('Eigen');
    expect(screen.queryByText('From BAG')).not.toBeInTheDocument();
  });

  it('#59 AC17: gives the search field, house number and postal code the right keyboards', () => {
    setup(fakeApi());
    expect(screen.getByLabelText(/^House number/)).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText(/^Postal code/)).not.toHaveAttribute('inputmode');
    expect(search()).toHaveAttribute('autocomplete', 'off');
  });
});

describe('PropertyForm refresh', () => {
  const existing = { street: 'Oud', houseNumber: '12', postalCode: '9999 SS', city: 'Oudstad', ownerName: 'Anna' };

  it('#59 AC11: has no button on the add form and does not look up by itself on the edit form', () => {
    const api = fakeApi();
    setup(api, { initial: existing });
    expect(screen.queryByRole('button', { name: 'Look up in BAG' })).not.toBeInTheDocument();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('#59 AC11: replaces and marks street and city only', async () => {
    const api = fakeApi();
    const { user } = setup(api, { refresh: true, initial: existing });
    await user.click(screen.getByRole('button', { name: 'Look up in BAG' }));
    await waitFor(() => expect(value(/^Street/)).toBe('Voorbeeldstraat'));
    expect(api.refresh).toHaveBeenCalledWith({ postalCode: '9999 SS', houseNumber: '12', addition: '' });
    expect(value(/^City/)).toBe('Testdorp');
    expect(value(/^Postal code/)).toBe('9999 SS');
    expect(screen.getAllByText('From BAG')).toHaveLength(2);
  });

  it('#59 AC12: says so when the address is not found and changes no field', async () => {
    const { user } = setup(fakeApi({ refresh: async () => ({ status: 'not_found' }) }), { refresh: true, initial: existing });
    await user.click(screen.getByRole('button', { name: 'Look up in BAG' }));
    expect(await screen.findByText('Address not found in the BAG. Please fill in the fields yourself.')).toBeInTheDocument();
    expect(value(/^Street/)).toBe('Oud');
  });

  it('#59 AC10: shows a failure message when the service is unavailable', async () => {
    const { user } = setup(fakeApi({ refresh: async () => ({ status: 'unavailable' }) }), { refresh: true, initial: existing });
    await user.click(screen.getByRole('button', { name: 'Look up in BAG' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not available right now');
    expect(value(/^Street/)).toBe('Oud');
  });

  it('#59 AC11: asks for a valid postal code and house number when the API answers 400', async () => {
    const refresh = vi.fn(async () => {
      throw new ApiError('Please correct the highlighted fields.', 400, { postalCode: 'x' });
    });
    const { user } = setup(fakeApi({ refresh }), { refresh: true, initial: { ...existing, postalCode: '12' } });
    await user.click(screen.getByRole('button', { name: 'Look up in BAG' }));
    expect(await screen.findByText('Fill in a valid postal code and house number to look up the address.')).toBeInTheDocument();
  });

  it('#59 AC12: offers the additions, fills the chosen one and looks up again', async () => {
    const refresh = vi
      .fn<AddressApi['refresh']>()
      .mockResolvedValueOnce({ status: 'several', additions: ['A', '1'] })
      .mockResolvedValueOnce({ status: 'found', address: ADDRESS });
    const { user } = setup(fakeApi({ refresh }), { refresh: true, initial: existing });
    await user.click(screen.getByRole('button', { name: 'Look up in BAG' }));
    await user.click(await screen.findByRole('button', { name: 'A' }));
    expect(refresh).toHaveBeenLastCalledWith({ postalCode: '9999 SS', houseNumber: '12', addition: 'A' });
    await waitFor(() => expect(value(/^Street/)).toBe('Voorbeeldstraat'));
    expect(value(/^Addition/)).toBe('A');
  });

  it('#59 AC11: discards the result when the house number changed meanwhile', async () => {
    let resolve: (v: RefreshOutcome) => void = () => {};
    const { user } = setup(fakeApi({ refresh: () => new Promise((r) => (resolve = r)) }), { refresh: true, initial: existing });
    await user.click(screen.getByRole('button', { name: 'Look up in BAG' }));
    await user.type(screen.getByLabelText(/^House number/), '3');
    resolve({ status: 'found', address: ADDRESS });
    await new Promise((r) => setTimeout(r, 20));
    expect(value(/^Street/)).toBe('Oud');
    expect(screen.queryByText('From BAG')).not.toBeInTheDocument();
  });

  it('#59 AC11: keeps a street typed while the lookup runs', async () => {
    let resolve: (v: RefreshOutcome) => void = () => {};
    const { user } = setup(fakeApi({ refresh: () => new Promise((r) => (resolve = r)) }), { refresh: true, initial: existing });
    await user.click(screen.getByRole('button', { name: 'Look up in BAG' }));
    expect(screen.getByText('Looking up the address...')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Street/), '!');
    resolve({ status: 'found', address: ADDRESS });
    await waitFor(() => expect(value(/^City/)).toBe('Testdorp'));
    expect(value(/^Street/)).toBe('Oud!');
  });
});
