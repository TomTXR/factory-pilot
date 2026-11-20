import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type Address,
  type AddressApi,
  type AddressSuggestion,
  ApiError,
  createAddressApi,
  type Property,
  type PropertyFormValues,
} from '../api';
import { AddressSearch } from './AddressSearch';

const defaultAddressApi = createAddressApi();

/** The fields the address service can fill. */
const ADDRESS_FIELDS = ['street', 'houseNumber', 'houseNumberAddition', 'postalCode', 'city'] as const;
type AddressField = (typeof ADDRESS_FIELDS)[number];
/** The fields a refresh looks up by. A change to one of them makes a running refresh obsolete. */
const KEY_FIELDS = ['postalCode', 'houseNumber', 'houseNumberAddition'] as const;

type Note =
  | { kind: 'loading' | 'info' | 'unavailable'; text: string }
  | { kind: 'several'; additions: string[] };

export const emptyValues: PropertyFormValues = {
  displayName: '',
  street: '',
  houseNumber: '',
  houseNumberAddition: '',
  postalCode: '',
  city: '',
  country: 'NL',
  ownerName: '',
  propertyType: '',
  yearBuilt: '',
  livingAreaM2: '',
  rooms: '',
  notes: '',
};

export function valuesFromProperty(p: Property): PropertyFormValues {
  return {
    displayName: p.displayName ?? '',
    street: p.street,
    houseNumber: p.houseNumber,
    houseNumberAddition: p.houseNumberAddition,
    postalCode: p.postalCode,
    city: p.city,
    country: p.country,
    ownerName: p.ownerName,
    propertyType: p.propertyType ?? '',
    yearBuilt: p.yearBuilt === null ? '' : String(p.yearBuilt),
    livingAreaM2: p.livingAreaM2 === null ? '' : String(p.livingAreaM2),
    rooms: p.rooms === null ? '' : String(p.rooms),
    notes: p.notes ?? '',
  };
}

interface Props {
  title: string;
  submitLabel: string;
  initial: PropertyFormValues;
  onSubmit: (values: PropertyFormValues) => Promise<void>;
  onCancel: () => void;
  /** Shows the "Look up in BAG" button (Dutch properties only). Used on the edit form. */
  refresh?: boolean;
  addressApi?: AddressApi;
}

interface FieldProps {
  name: keyof PropertyFormValues;
  label: string;
  error?: string;
  required?: boolean;
  /** True when the value was filled from the BAG and not changed since. */
  fromBag?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}

function Field({ name, label, error, required, fromBag, className, children }: FieldProps) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-slate-500"> (required)</span>}
        {fromBag && (
          <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800">From BAG</span>
        )}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? errorId : undefined })}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function RefreshNote({ note, onChoose }: { note: Note | null; onChoose: (addition: string) => void }) {
  if (!note) return <p role="status" className="empty:hidden" />;
  if (note.kind === 'several') {
    return (
      <div role="status" className="mt-2 text-sm text-slate-800">
        <p>Several addresses match. Choose the addition:</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {note.additions.map((a) => (
            <li key={a}>
              <button type="button" onClick={() => onChoose(a)} className="btn-secondary min-w-11">
                {a}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (note.kind === 'unavailable') {
    return (
      <p role="alert" className="mt-2 text-sm text-red-700">
        {note.text}
      </p>
    );
  }
  return (
    <p role="status" className="mt-2 text-sm text-slate-700">
      {note.text}
    </p>
  );
}

/** Used for both adding and editing. Values stay in state while saving fails, so nothing typed is lost. */
export function PropertyForm({
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
  refresh = false,
  addressApi = defaultAddressApi,
}: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const focusErrors = useRef(false);

  useEffect(() => {
    if (!focusErrors.current || Object.keys(errors).length === 0) return;
    focusErrors.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  // Markers live only in this form. A hand edit removes the marker of its field.
  const [fromBag, setFromBag] = useState<ReadonlySet<AddressField>>(new Set());
  const [pickNote, setPickNote] = useState<{ kind: 'loading' | 'unavailable'; text: string } | null>(null);
  const [refreshNote, setRefreshNote] = useState<Note | null>(null);
  /** Counts hand edits per field, so a result never overwrites a field changed while it was loading. */
  const edits = useRef<Record<string, number>>({});
  /** Only the latest pick or refresh may apply its result. */
  const request = useRef(0);

  const isAddressField = (name: string): name is AddressField => (ADDRESS_FIELDS as readonly string[]).includes(name);

  function change(name: keyof PropertyFormValues, value: string) {
    edits.current[name] = (edits.current[name] ?? 0) + 1;
    setValues((v) => ({ ...v, [name]: value }));
    if (isAddressField(name)) setFromBag((m) => (m.has(name) ? new Set([...m].filter((f) => f !== name)) : m));
  }

  const bind = (name: keyof PropertyFormValues) => ({
    name,
    value: values[name],
    className: 'input',
    onChange: (e: { target: { value: string } }) => change(name, e.target.value),
  });

  const marked = (name: AddressField) => fromBag.has(name);

  /** Fills and marks the given fields, except those changed by hand since `snapshot` was taken. */
  function fill(address: Address, fields: readonly AddressField[], snapshot: Record<string, number>) {
    const open = fields.filter((f) => (edits.current[f] ?? 0) === (snapshot[f] ?? 0));
    setValues((v) => ({ ...v, ...Object.fromEntries(open.map((f) => [f, address[f]])) }));
    setFromBag((m) => new Set([...m, ...open]));
  }

  async function pickAddress(suggestion: AddressSuggestion) {
    const run = ++request.current;
    const snapshot = { ...edits.current };
    setPickNote({ kind: 'loading', text: 'Loading the address...' });
    setRefreshNote(null);
    const result = await addressApi.lookupById(suggestion.id).catch(() => ({ status: 'unavailable' as const }));
    if (run !== request.current) return;
    if (result.status === 'found') {
      fill(result.address, ADDRESS_FIELDS, snapshot);
      setPickNote(null);
    } else {
      setPickNote({ kind: 'unavailable', text: 'The address search is not available right now. You can fill in the fields yourself.' });
    }
  }

  async function lookUp(addition: string = values.houseNumberAddition) {
    const run = ++request.current;
    const snapshot = { ...edits.current };
    setPickNote(null);
    setRefreshNote({ kind: 'loading', text: 'Looking up the address...' });
    try {
      const result = await addressApi.refresh({ postalCode: values.postalCode, houseNumber: values.houseNumber, addition });
      // Discard the answer when the postal code, house number or addition changed in the meantime.
      if (run !== request.current || KEY_FIELDS.some((f) => (edits.current[f] ?? 0) !== (snapshot[f] ?? 0))) return;
      if (result.status === 'found') {
        fill(result.address, ['street', 'city'], snapshot);
        setRefreshNote(null);
      } else if (result.status === 'several') {
        setRefreshNote({ kind: 'several', additions: result.additions });
      } else if (result.status === 'not_found') {
        setRefreshNote({ kind: 'info', text: 'Address not found in the BAG. Please fill in the fields yourself.' });
      } else {
        setRefreshNote({ kind: 'unavailable', text: 'The address lookup is not available right now. You can fill in the fields yourself.' });
      }
    } catch (err) {
      if (run !== request.current) return;
      setRefreshNote(
        err instanceof ApiError && err.status === 400
          ? { kind: 'info', text: 'Fill in a valid postal code and house number to look up the address.' }
          : { kind: 'unavailable', text: 'The address lookup is not available right now. You can fill in the fields yourself.' },
      );
    }
  }

  function chooseAddition(addition: string) {
    change('houseNumberAddition', addition);
    void lookUp(addition);
  }

  function changeCountry(country: string) {
    // Switching the country clears no field. It only stops what the address service was doing.
    request.current++;
    setPickNote(null);
    setRefreshNote(null);
    change('country', country);
  }

  const dutch = values.country === 'NL';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setErrors({});
    try {
      await onSubmit(values);
    } catch (err) {
      focusErrors.current = true;
      if (err instanceof ApiError && err.status === 400) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else if (err instanceof ApiError && err.duplicate) {
        setFormError('This property already exists');
      } else {
        setFormError(err instanceof ApiError ? `${err.message} Please try again.` : 'Saving failed. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="form-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="form-title" className="text-xl font-semibold text-slate-900">
        {title}
      </h2>
      <form ref={formRef} onSubmit={submit} noValidate className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-6">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800 sm:col-span-6">
            {formError}
          </p>
        )}
        <Field name="displayName" label="Display name" error={errors.displayName} className="sm:col-span-6">
          {(p) => <input type="text" {...p} {...bind('displayName')} />}
        </Field>
        <Field name="country" label="Country" error={errors.country} className="sm:col-span-6">
          {(p) => (
            <select {...p} {...bind('country')} onChange={(e) => changeCountry(e.target.value)}>
              <option value="NL">Netherlands</option>
              <option value="DE">Germany</option>
            </select>
          )}
        </Field>
        {dutch && (
          <div className="sm:col-span-6">
            <AddressSearch api={addressApi} onPick={(s) => void pickAddress(s)} message={pickNote} />
          </div>
        )}
        <Field name="street" label="Street" required fromBag={marked('street')} error={errors.street} className="sm:col-span-6">
          {(p) => <input type="text" autoComplete="street-address" {...p} {...bind('street')} />}
        </Field>
        <Field
          name="houseNumber"
          label="House number"
          required
          fromBag={marked('houseNumber')}
          error={errors.houseNumber}
          className="sm:col-span-3"
        >
          {(p) => <input type="text" inputMode="numeric" {...p} {...bind('houseNumber')} />}
        </Field>
        <Field
          name="houseNumberAddition"
          label="Addition"
          fromBag={marked('houseNumberAddition')}
          error={errors.houseNumberAddition}
          className="sm:col-span-3"
        >
          {(p) => <input type="text" {...p} {...bind('houseNumberAddition')} />}
        </Field>
        <Field
          name="postalCode"
          label="Postal code"
          required
          fromBag={marked('postalCode')}
          error={errors.postalCode}
          className="sm:col-span-2"
        >
          {(p) => <input type="text" autoComplete="postal-code" {...p} {...bind('postalCode')} />}
        </Field>
        <Field name="city" label="City" required fromBag={marked('city')} error={errors.city} className="sm:col-span-4">
          {(p) => <input type="text" autoComplete="address-level2" {...p} {...bind('city')} />}
        </Field>
        {refresh && dutch && (
          <div className="sm:col-span-6">
            <button type="button" onClick={() => void lookUp()} className="btn-secondary w-full sm:w-auto">
              Look up in BAG
            </button>
            <RefreshNote note={refreshNote} onChoose={chooseAddition} />
          </div>
        )}
        <Field name="ownerName" label="Owner name" required error={errors.ownerName} className="sm:col-span-6">
          {(p) => <input type="text" {...p} {...bind('ownerName')} />}
        </Field>

        <h3 className="mt-2 text-base font-semibold text-slate-900 sm:col-span-6">Characteristics (optional)</h3>
        <Field name="propertyType" label="Property type" error={errors.propertyType} className="sm:col-span-3">
          {(p) => (
            <select {...p} {...bind('propertyType')}>
              <option value="">Not specified</option>
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="other">Other</option>
            </select>
          )}
        </Field>
        <Field name="yearBuilt" label="Year built" error={errors.yearBuilt} className="sm:col-span-3">
          {(p) => <input type="text" inputMode="numeric" {...p} {...bind('yearBuilt')} />}
        </Field>
        <Field name="livingAreaM2" label="Living area (m2)" error={errors.livingAreaM2} className="sm:col-span-3">
          {(p) => <input type="text" inputMode="decimal" {...p} {...bind('livingAreaM2')} />}
        </Field>
        <Field name="rooms" label="Number of rooms" error={errors.rooms} className="sm:col-span-3">
          {(p) => <input type="text" inputMode="numeric" {...p} {...bind('rooms')} />}
        </Field>
        <Field name="notes" label="Notes" error={errors.notes} className="sm:col-span-6">
          {(p) => <textarea rows={3} {...p} {...bind('notes')} />}
        </Field>

        <div className="flex flex-col-reverse gap-3 sm:col-span-6 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
