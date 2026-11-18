-- Properties of a home owner. Identity is the normalised address plus owner (see the unique index).
create table properties (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  street text not null,
  house_number text not null,
  house_number_addition text not null default '',
  postal_code text not null,
  city text not null,
  country text not null default 'NL',
  owner_name text not null,
  property_type text,
  year_built integer,
  living_area_m2 numeric(8, 2),
  rooms integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_required_not_blank check (
    btrim(street) <> '' and btrim(house_number) <> '' and btrim(postal_code) <> ''
    and btrim(city) <> '' and btrim(owner_name) <> ''
  ),
  constraint properties_country_valid check (country in ('NL', 'DE')),
  constraint properties_type_valid check (property_type is null or property_type in ('house', 'apartment', 'other')),
  constraint properties_year_valid check (year_built is null or year_built between 1500 and 2100),
  constraint properties_area_valid check (living_area_m2 is null or living_area_m2 > 0),
  constraint properties_rooms_valid check (rooms is null or rooms > 0)
);

-- Case-insensitive, whitespace-collapsed identity. Must match normaliseKey in api/src/properties.ts.
create unique index properties_identity_idx on properties (
  lower(regexp_replace(btrim(street), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(house_number), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(house_number_addition), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(postal_code), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(city), '\s+', ' ', 'g')),
  country,
  lower(regexp_replace(btrim(owner_name), '\s+', ' ', 'g'))
);
