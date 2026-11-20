/** One address in the suggestion list. `label` is plain text, safe to show as it is. */
export interface AddressSuggestion {
  id: string;
  label: string;
}

/** A full address as the form needs it. The postal code is written as "1234 AB". */
export interface Address {
  street: string;
  houseNumber: string;
  houseNumberAddition: string;
  postalCode: string;
  city: string;
}

export type SuggestResult = { status: 'ok'; suggestions: AddressSuggestion[] } | { status: 'unavailable' };

export type LookupResult = { status: 'found'; address: Address } | { status: 'not_found' } | { status: 'unavailable' };

export type RefreshResult =
  | { status: 'found'; address: Address }
  | { status: 'several'; additions: string[] }
  | { status: 'not_found' }
  | { status: 'unavailable' };

/**
 * Address data source. Injected into the app like the Google client. Methods never throw:
 * every external failure is answered with `unavailable`.
 */
export interface AddressClient {
  /** Up to 8 full addresses matching free text. */
  suggest: (text: string) => Promise<SuggestResult>;
  /** The address behind an id from `suggest`. */
  lookupById: (id: string) => Promise<LookupResult>;
  /** The address for a postal code (any notation), house number and optional addition. */
  lookupByPostalCode: (p: { postalCode: string; houseNumber: string; addition: string }) => Promise<RefreshResult>;
}

export const MAX_SUGGESTIONS = 8;

const POSTAL_CODE = /^([1-9]\d{3})\s?([a-z]{2})$/i;
const ADDRESS_ID = /^[a-z]{3}-[0-9a-f]{32}$/i;
const MAX_ADDITION = 200;

/** "1234ab" and "1234 AB" both become "1234 AB". Returns null for anything else. */
export function normalisePostalCode(raw: string): string | null {
  const m = POSTAL_CODE.exec(raw.trim());
  return m ? `${m[1]} ${(m[2] as string).toUpperCase()}` : null;
}

/** A house number from 1 to 99999 without sign, decimals or letters. Returns it without leading zeros. */
export function normaliseHouseNumber(raw: string): string | null {
  const v = raw.trim();
  if (!/^\d{1,5}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= 99999 ? String(n) : null;
}

export function isAddressId(value: string): boolean {
  return ADDRESS_ID.test(value);
}

export function isValidAddition(value: string): boolean {
  return value.length <= MAX_ADDITION;
}

/**
 * The BAG has a house letter and a house number addition, the app one "Addition" field:
 * letter only "A", addition only "2", both "A-2".
 */
export function formatAddition(letter: string | undefined, addition: string | undefined): string {
  const l = (letter ?? '').trim();
  const a = (addition ?? '').trim();
  return l && a ? `${l}-${a}` : l || a;
}

/** Key for comparing additions: case, spaces and dashes do not matter ("A-2", "a 2" and "A2" are equal). */
export function additionKey(addition: string): string {
  return addition.toLowerCase().replace(/[\s-]+/g, '');
}

/**
 * Picks the address for a refresh from all addresses with one postal code and house number.
 * With an addition, only a matching one counts. Without, the one without addition, or the only one.
 */
export function chooseAddress(candidates: Address[], addition: string): RefreshResult {
  if (candidates.length === 0) return { status: 'not_found' };
  const key = additionKey(addition);
  const matches = candidates.filter((c) => additionKey(c.houseNumberAddition) === key);
  const [match] = matches;
  if (match && matches.length === 1) return { status: 'found', address: match };
  if (!key && candidates.length === 1) return { status: 'found', address: candidates[0] as Address };
  const additions = [...new Set(candidates.map((c) => c.houseNumberAddition).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'nl', { numeric: true }),
  );
  return additions.length > 0 ? { status: 'several', additions } : { status: 'not_found' };
}
