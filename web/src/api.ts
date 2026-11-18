export type ApiStatus = 'loading' | 'ok' | 'degraded' | 'unreachable';

export async function fetchHealth(fetchFn: typeof fetch = fetch): Promise<ApiStatus> {
  try {
    const res = await fetchFn('/api/health');
    const body = (await res.json()) as { status?: string };
    return body.status === 'ok' ? 'ok' : 'degraded';
  } catch {
    return 'unreachable';
  }
}

export async function fetchVersion(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn('/api/version');
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === 'string' ? body.version : null;
  } catch {
    return null;
  }
}

export type Country = 'NL' | 'DE';
export type PropertyType = 'house' | 'apartment' | 'other';

/** Editable property fields as typed in the form. Numbers stay text; the API validates them. */
export interface PropertyFormValues {
  displayName: string;
  street: string;
  houseNumber: string;
  houseNumberAddition: string;
  postalCode: string;
  city: string;
  country: Country;
  ownerName: string;
  propertyType: PropertyType | '';
  yearBuilt: string;
  livingAreaM2: string;
  rooms: string;
  notes: string;
}

export interface Property {
  id: string;
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

/** Failed API call. `fieldErrors` is set for a 400 response, `duplicate` for a 409. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }

  get duplicate(): boolean {
    return this.status === 409;
  }
}

export interface PropertiesApi {
  list: () => Promise<Property[]>;
  create: (values: PropertyFormValues) => Promise<Property>;
  update: (id: string, values: PropertyFormValues) => Promise<Property>;
  remove: (id: string) => Promise<void>;
}

async function request(fetchFn: typeof fetch, path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(path, init);
  } catch {
    throw new ApiError('The server could not be reached.', null);
  }
  if (res.ok) return res;
  const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string> };
  if (res.status === 400) throw new ApiError('Please correct the highlighted fields.', 400, body.errors);
  if (res.status === 409) throw new ApiError(body.error ?? 'This property already exists', 409);
  if (res.status === 404) throw new ApiError('This property no longer exists.', 404);
  throw new ApiError('Something went wrong on the server.', res.status);
}

const json = (method: string, values: PropertyFormValues): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(values),
});

export function createPropertiesApi(fetchFn: typeof fetch = (...args) => fetch(...args)): PropertiesApi {
  return {
    async list() {
      return (await (await request(fetchFn, '/api/properties')).json()) as Property[];
    },
    async create(values) {
      return (await (await request(fetchFn, '/api/properties', json('POST', values))).json()) as Property;
    },
    async update(id, values) {
      return (await (await request(fetchFn, `/api/properties/${id}`, json('PUT', values))).json()) as Property;
    },
    async remove(id) {
      await request(fetchFn, `/api/properties/${id}`, { method: 'DELETE' });
    },
  };
}

export function propertyLabel(p: Property): string {
  return p.displayName ?? `${p.street} ${p.houseNumber}${p.houseNumberAddition ? ` ${p.houseNumberAddition}` : ''}`;
}
