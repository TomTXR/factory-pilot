import type { ReactNode } from 'react';
import { type Property, propertyLabel } from '../api';

const countryName = { NL: 'Netherlands', DE: 'Germany' } as const;
const typeName = { house: 'House', apartment: 'Apartment', other: 'Other' } as const;

interface Props {
  property: Property;
  onEdit: () => void;
  onDelete: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-5 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-slate-900 sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  );
}

export function PropertyDetails({ property: p, onEdit, onDelete }: Props) {
  const addition = p.houseNumberAddition ? ` ${p.houseNumberAddition}` : '';
  const characteristics: [string, ReactNode][] = [];
  if (p.propertyType) characteristics.push(['Type', typeName[p.propertyType]]);
  if (p.yearBuilt !== null) characteristics.push(['Year built', p.yearBuilt]);
  if (p.livingAreaM2 !== null) characteristics.push(['Living area', `${p.livingAreaM2} m²`]);
  if (p.rooms !== null) characteristics.push(['Rooms', p.rooms]);
  if (p.notes) characteristics.push(['Notes', p.notes]);

  return (
    <section aria-labelledby="property-title" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="property-title" className="text-xl font-semibold text-slate-900">
          {propertyLabel(p)}
        </h2>
        <div className="flex gap-3">
          <button type="button" onClick={onEdit} className="btn-secondary flex-1 sm:flex-none">
            Edit property
          </button>
          <button type="button" onClick={onDelete} className="btn-danger flex-1 sm:flex-none">
            Delete property
          </button>
        </div>
      </div>
      <dl className="divide-y divide-slate-100">
        {p.displayName && <Row label="Name">{p.displayName}</Row>}
        <Row label="Owner">{p.ownerName}</Row>
        <Row label="Address">
          {`${p.street} ${p.houseNumber}${addition}\n${p.postalCode} ${p.city}\n${countryName[p.country]}`}
        </Row>
        {characteristics.map(([label, value]) => (
          <Row key={label} label={label}>
            {value}
          </Row>
        ))}
      </dl>
    </section>
  );
}
