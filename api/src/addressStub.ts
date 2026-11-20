import {
  type Address,
  type AddressClient,
  chooseAddress,
  MAX_SUGGESTIONS,
  normalisePostalCode,
} from './addressClient.js';

/**
 * Stub address service for CI and local stacks. All addresses are synthetic: the postal codes
 * use the letter pairs SA, SD and SS, which are never issued, and the names are invented.
 * Special inputs: postal code 9990 SD answers "unavailable", 9991 SD answers after a short delay.
 */
const UNAVAILABLE_CODE = '9990sd';
const SLOW_CODE = '9991sd';
const SLOW_MS = 800;

const addr = (street: string, houseNumber: string, addition: string, postalCode: string, city: string): Address => ({
  street,
  houseNumber,
  houseNumberAddition: addition,
  postalCode,
  city,
});

export const STUB_ADDRESSES: Address[] = [
  addr('Voorbeeldstraat', '12', '', '9999 SS', 'Testdorp'),
  addr('Voorbeeldstraat', '14', 'A', '9999 SS', 'Testdorp'),
  addr('Voorbeeldstraat', '14', '1', '9999 SS', 'Testdorp'),
  addr('Voorbeeldstraat', '14', 'A-2', '9999 SS', 'Testdorp'),
  addr('Proefweg', '3', '', '9998 SD', 'Teststad'),
  addr('Proefweg', '5', '', '9998 SD', 'Teststad'),
  addr('Vertraagdlaan', '1', '', '9991 SD', 'Wachtdorp'),
  addr('Storingsplein', '1', '', '9990 SD', 'Stilstad'),
];

const idOf = (index: number) => `adr-${String(index + 1).padStart(32, '0')}`;

const label = (a: Address) =>
  `${a.street} ${a.houseNumber}${a.houseNumberAddition.replace(/^(\d)/, '-$1')}, ${a.postalCode} ${a.city}`;

const squash = (v: string) => v.toLowerCase().replace(/[\s,-]+/g, '');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulate(text: string): Promise<boolean> {
  const t = squash(text);
  if (t.includes(UNAVAILABLE_CODE)) return false;
  if (t.includes(SLOW_CODE)) await wait(SLOW_MS);
  return true;
}

export function createStubAddressClient(): AddressClient {
  return {
    async suggest(text) {
      if (!(await simulate(text))) return { status: 'unavailable' };
      // Every word of the text must occur in the address, in any order, like the real service.
      const words = text.split(/[\s,]+/).map(squash).filter(Boolean);
      const suggestions = STUB_ADDRESSES.flatMap((a, i) => {
        const full = squash(label(a));
        return words.every((w) => full.includes(w)) ? [{ id: idOf(i), label: label(a) }] : [];
      });
      return { status: 'ok', suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
    },
    async lookupById(id) {
      const index = STUB_ADDRESSES.findIndex((_, i) => idOf(i) === id);
      const found = STUB_ADDRESSES[index];
      if (!found) return { status: 'not_found' };
      if (!(await simulate(found.postalCode))) return { status: 'unavailable' };
      return { status: 'found', address: found };
    },
    async lookupByPostalCode({ postalCode, houseNumber, addition }) {
      const code = normalisePostalCode(postalCode);
      if (!code || !(await simulate(code))) return { status: code ? 'unavailable' : 'not_found' };
      return chooseAddress(
        STUB_ADDRESSES.filter((a) => a.postalCode === code && a.houseNumber === houseNumber),
        addition,
      );
    },
  };
}
