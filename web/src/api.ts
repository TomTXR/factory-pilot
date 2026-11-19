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

export interface User {
  id: string;
  email: string;
  name: string;
}

/** `google` shows the Google button, `test` the labelled synthetic sign-in (previews, CI, local). */
export type SignInMode = 'google' | 'test';

/** Returns the signed-in user, or null when there is no valid session. Throws when the API is unreachable. */
export async function fetchMe(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<User | null> {
  const res = await fetchFn('/api/auth/me');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth check failed with status ${res.status}`);
  return (await res.json()) as User;
}

export async function fetchSignInMode(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<SignInMode> {
  const res = await fetchFn('/api/auth/config');
  if (!res.ok) throw new Error(`auth config failed with status ${res.status}`);
  const body = (await res.json()) as { mode?: unknown };
  return body.mode === 'google' ? 'google' : 'test';
}

export async function testSignIn(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  const res = await fetchFn('/api/auth/test-login', { method: 'POST' });
  if (!res.ok) throw new Error(`test sign-in failed with status ${res.status}`);
}

export async function signOut(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  const res = await fetchFn('/api/auth/logout', { method: 'POST' });
  if (!res.ok) throw new Error(`sign-out failed with status ${res.status}`);
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

/** Failed API call. `fieldErrors` is set for a 400 response, `duplicate` for a 409, `unauthorized` for a 401. */
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

  get unauthorized(): boolean {
    return this.status === 401;
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
  if (res.status === 401) throw new ApiError('You are not signed in.', 401);
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

/** Permanently deletes the signed-in account with all its properties. The server needs the typed confirmation. */
export async function deleteAccount(fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  await request(fetchFn, '/api/auth/account', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: 'DELETE' }),
  });
}
