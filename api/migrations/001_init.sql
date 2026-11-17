-- Baseline. Domain tables are added by later migrations (one file per change, never edit an applied file).
create table if not exists app_info (
  key text primary key,
  value text not null
);
