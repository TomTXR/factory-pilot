-- Accounts created on first Google sign-in, matched on the Google user id (never the email).
create table users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- Server-side sessions. Only the hash of the random cookie value is stored.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_expires_at_idx on sessions (expires_at);
