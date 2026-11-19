-- Records that the one-time claim of unowned properties has happened (single row). Later accounts never claim,
-- so an unowned row that could not be given to the first account is not handed to another account.
create table property_claim (
  singleton boolean primary key default true check (singleton),
  claimed_by uuid not null references users (id),
  claimed_at timestamptz not null default now()
);
