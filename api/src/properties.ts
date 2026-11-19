export const COUNTRIES = ['NL', 'DE'] as const;
export const PROPERTY_TYPES = ['house', 'apartment', 'other'] as const;

export type Country = (typeof COUNTRIES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** The editable fields of a property, after validation. */
export interface PropertyInput {
  displayName: string | null;
  street: string;
  houseNumber: string;
  houseNumberAddition: string;
  postalCode: string;
  city: string;
  country: Country;
  ownerName: string;
  propertyType: PropertyType | null;
  yearBuilt: number | null;
  livingAreaM2: number | null;
  rooms: number | null;
  notes: string | null;
}

export interface Property extends PropertyInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** Error messages per field name. */
export type FieldErrors = Record<string, string>;

export type ValidationResult = { ok: true; value: PropertyInput } | { ok: false; errors: FieldErrors };

/** Persistence of properties. Injected into the app so routes can be tested without a database. */
export interface PropertyRepository {
  /** Every method works on the properties of `userId` only; other accounts' rows do not exist for it. */
  list: (userId: string) => Promise<Property[]>;
  get: (userId: string, id: string) => Promise<Property | null>;
  create: (userId: string, input: PropertyInput) => Promise<Property | 'duplicate'>;
  /** Returns null when the id does not exist or belongs to another account. */
  update: (userId: string, id: string, input: PropertyInput) => Promise<Property | 'duplicate' | null>;
  /** Returns false when the id does not exist or belongs to another account. */
  remove: (userId: string, id: string) => Promise<boolean>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 200;
const MAX_NOTES = 2000;
const MIN_YEAR = 1500;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Trims and collapses repeated whitespace. */
export function collapse(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Identity of a property within one account: address plus owner, lower-cased and whitespace-collapsed.
 * The unique index in migration 004 uses the same normalisation.
 */
export function normaliseKey(p: PropertyInput): string {
  return [p.street, p.houseNumber, p.houseNumberAddition, p.postalCode, p.city, p.country, p.ownerName]
    .map((v) => collapse(v).toLowerCase())
    .join('|');
}

function text(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return '';
  return typeof raw === 'string' ? collapse(raw) : undefined;
}

function toNumber(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** One validation path for create and update. */
export function validateProperty(body: unknown, now: Date = new Date()): ValidationResult {
  const errors: FieldErrors = {};
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: { _: 'Request body must be a JSON object' } };
  }
  const input = body as Record<string, unknown>;

  const required = (field: string, label: string): string => {
    const v = text(input[field]);
    if (v === undefined) errors[field] = `${label} must be text`;
    else if (v === '') errors[field] = `${label} is required`;
    else if (v.length > MAX_TEXT) errors[field] = `${label} must be at most ${MAX_TEXT} characters`;
    return v ?? '';
  };

  const street = required('street', 'Street');
  const houseNumber = required('houseNumber', 'House number');
  const postalCode = required('postalCode', 'Postal code');
  const city = required('city', 'City');
  const ownerName = required('ownerName', 'Owner name');

  const optional = (field: string, label: string, max: number): string => {
    const v = text(input[field]);
    if (v === undefined) errors[field] = `${label} must be text`;
    else if (v.length > max) errors[field] = `${label} must be at most ${max} characters`;
    return v ?? '';
  };
  const displayName = optional('displayName', 'Display name', MAX_TEXT);
  const houseNumberAddition = optional('houseNumberAddition', 'Addition', MAX_TEXT);

  const notesRaw = input.notes;
  let notes = '';
  if (notesRaw !== undefined && notesRaw !== null) {
    if (typeof notesRaw !== 'string') errors.notes = 'Notes must be text';
    else if (notesRaw.length > MAX_NOTES) errors.notes = `Notes must be at most ${MAX_NOTES} characters`;
    else notes = notesRaw.trim();
  }

  let country: Country = 'NL';
  const countryRaw = input.country;
  if (countryRaw !== undefined && countryRaw !== null && countryRaw !== '') {
    if ((COUNTRIES as readonly unknown[]).includes(countryRaw)) country = countryRaw as Country;
    else errors.country = 'Country must be NL or DE';
  }

  let propertyType: PropertyType | null = null;
  const typeRaw = input.propertyType;
  if (typeRaw !== undefined && typeRaw !== null && typeRaw !== '') {
    if ((PROPERTY_TYPES as readonly unknown[]).includes(typeRaw)) propertyType = typeRaw as PropertyType;
    else errors.propertyType = 'Property type must be house, apartment or other';
  }

  let yearBuilt: number | null = null;
  const year = toNumber(input.yearBuilt);
  if (year === undefined) errors.yearBuilt = 'Year built must be a number';
  else if (year !== null) {
    if (!Number.isInteger(year)) errors.yearBuilt = 'Year built must be a whole number';
    else if (year < MIN_YEAR || year > now.getUTCFullYear()) {
      errors.yearBuilt = `Year built must be between ${MIN_YEAR} and ${now.getUTCFullYear()}`;
    } else yearBuilt = year;
  }

  let livingAreaM2: number | null = null;
  const area = toNumber(input.livingAreaM2);
  if (area === undefined) errors.livingAreaM2 = 'Living area must be a number';
  else if (area !== null) {
    if (area <= 0 || area > 100000) errors.livingAreaM2 = 'Living area must be greater than 0 and at most 100000';
    else livingAreaM2 = Math.round(area * 100) / 100;
  }

  let rooms: number | null = null;
  const roomsNum = toNumber(input.rooms);
  if (roomsNum === undefined) errors.rooms = 'Rooms must be a number';
  else if (roomsNum !== null) {
    if (!Number.isInteger(roomsNum)) errors.rooms = 'Rooms must be a whole number';
    else if (roomsNum < 1 || roomsNum > 1000) errors.rooms = 'Rooms must be between 1 and 1000';
    else rooms = roomsNum;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      displayName: displayName === '' ? null : displayName,
      street,
      houseNumber,
      houseNumberAddition,
      postalCode,
      city,
      country,
      ownerName,
      propertyType,
      yearBuilt,
      livingAreaM2,
      rooms,
      notes: notes === '' ? null : notes,
    },
  };
}
