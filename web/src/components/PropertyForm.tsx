import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ApiError, type Property, type PropertyFormValues } from '../api';

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
}

interface FieldProps {
  name: keyof PropertyFormValues;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}

function Field({ name, label, error, required, className, children }: FieldProps) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-slate-500"> (required)</span>}
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

/** Used for both adding and editing. Values stay in state while saving fails, so nothing typed is lost. */
export function PropertyForm({ title, submitLabel, initial, onSubmit, onCancel }: Props) {
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

  const bind = (name: keyof PropertyFormValues) => ({
    name,
    value: values[name],
    className: 'input',
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

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
        <Field name="street" label="Street" required error={errors.street} className="sm:col-span-6">
          {(p) => <input type="text" autoComplete="street-address" {...p} {...bind('street')} />}
        </Field>
        <Field name="houseNumber" label="House number" required error={errors.houseNumber} className="sm:col-span-3">
          {(p) => <input type="text" {...p} {...bind('houseNumber')} />}
        </Field>
        <Field
          name="houseNumberAddition"
          label="Addition"
          error={errors.houseNumberAddition}
          className="sm:col-span-3"
        >
          {(p) => <input type="text" {...p} {...bind('houseNumberAddition')} />}
        </Field>
        <Field name="postalCode" label="Postal code" required error={errors.postalCode} className="sm:col-span-2">
          {(p) => <input type="text" autoComplete="postal-code" {...p} {...bind('postalCode')} />}
        </Field>
        <Field name="city" label="City" required error={errors.city} className="sm:col-span-4">
          {(p) => <input type="text" autoComplete="address-level2" {...p} {...bind('city')} />}
        </Field>
        <Field name="country" label="Country" error={errors.country} className="sm:col-span-3">
          {(p) => (
            <select {...p} {...bind('country')}>
              <option value="NL">Netherlands</option>
              <option value="DE">Germany</option>
            </select>
          )}
        </Field>
        <Field name="ownerName" label="Owner name" required error={errors.ownerName} className="sm:col-span-3">
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
