import { type Address, type AddressClient, chooseAddress, formatAddition, MAX_SUGGESTIONS, normalisePostalCode } from './addressClient.js';
import { logger } from './logger.js';

const BASE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';
const TIMEOUT_MS = 5000;
const ADDRESS_FIELDS = 'straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam';
/** Upper bound of addresses (additions) on one house number. */
const MAX_ROWS_PER_HOUSE_NUMBER = 100;

interface PdokDoc {
  id?: unknown;
  weergavenaam?: unknown;
  straatnaam?: unknown;
  huisnummer?: unknown;
  huisletter?: unknown;
  huisnummertoevoeging?: unknown;
  postcode?: unknown;
  woonplaatsnaam?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Maps one Locatieserver document to an address. Returns null when a required part is missing. */
export function toAddress(doc: PdokDoc): Address | null {
  const street = str(doc.straatnaam).trim();
  const houseNumber = str(doc.huisnummer).trim();
  const city = str(doc.woonplaatsnaam).trim();
  const postalCode = normalisePostalCode(str(doc.postcode));
  if (!street || !houseNumber || !city || !postalCode) return null;
  return {
    street,
    houseNumber,
    houseNumberAddition: formatAddition(str(doc.huisletter), str(doc.huisnummertoevoeging)),
    postalCode,
    city,
  };
}

/** PDOK Locatieserver (keyless). Parameters are only passed as encoded query values to a fixed host. */
export function createPdokClient(fetchFn: typeof fetch = (...a) => fetch(...a)): AddressClient {
  async function docs(path: string, params: [string, string][]): Promise<PdokDoc[] | null> {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [k, v] of params) url.searchParams.append(k, v);
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { response?: { docs?: unknown } };
      const list = body.response?.docs;
      if (!Array.isArray(list)) throw new Error('unexpected response');
      return list as PdokDoc[];
    } catch (err) {
      // Only the kind of failure is logged, never the request, which holds address data.
      logger.warn('address service failed', { error: err instanceof Error ? err.name : 'unknown' });
      return null;
    }
  }

  return {
    async suggest(text) {
      const list = await docs('suggest', [
        ['q', text],
        ['fq', 'type:adres'],
        ['rows', String(MAX_SUGGESTIONS)],
      ]);
      if (!list) return { status: 'unavailable' };
      const suggestions = list
        .flatMap((d) => {
          const id = str(d.id);
          const label = str(d.weergavenaam).trim();
          return id && label ? [{ id, label }] : [];
        })
        .slice(0, MAX_SUGGESTIONS);
      return { status: 'ok', suggestions };
    },
    async lookupById(id) {
      const list = await docs('lookup', [
        ['id', id],
        ['fl', ADDRESS_FIELDS],
      ]);
      if (!list) return { status: 'unavailable' };
      const address = list[0] ? toAddress(list[0]) : null;
      return address ? { status: 'found', address } : { status: 'not_found' };
    },
    async lookupByPostalCode({ postalCode, houseNumber, addition }) {
      const code = normalisePostalCode(postalCode);
      if (!code) return { status: 'not_found' };
      const list = await docs('free', [
        ['q', `postcode:${code.replace(' ', '')}`],
        ['fq', 'type:adres'],
        ['fq', `huisnummer:${houseNumber}`],
        ['fl', ADDRESS_FIELDS],
        ['rows', String(MAX_ROWS_PER_HOUSE_NUMBER)],
      ]);
      if (!list) return { status: 'unavailable' };
      const candidates = list.flatMap((d) => {
        const a = toAddress(d);
        return a && a.houseNumber === houseNumber ? [a] : [];
      });
      return chooseAddress(candidates, addition);
    },
  };
}
