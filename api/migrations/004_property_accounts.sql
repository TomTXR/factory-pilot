-- Each property belongs to one account. Nullable: rows created before this migration have no account until
-- the first account signs in and claims them. No cascade: deleting an account must not delete data.
alter table properties add column account_user_id uuid references users (id);

create index properties_account_user_id_idx on properties (account_user_id);

-- The duplicate check applies per account. Must match normaliseKey in api/src/properties.ts.
-- Unowned rows (null account) are never equal to each other here; they only exist until claimed.
create unique index properties_account_identity_idx on properties (
  account_user_id,
  lower(regexp_replace(btrim(street), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(house_number), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(house_number_addition), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(postal_code), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(city), '\s+', ' ', 'g')),
  country,
  lower(regexp_replace(btrim(owner_name), '\s+', ' ', 'g'))
);

drop index properties_identity_idx;
