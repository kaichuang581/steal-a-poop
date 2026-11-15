-- Site visits: one row per UTC day with two counters, for the admin panel's numbers (requested by Kai, 2026-11-15).
-- Nothing here is about a person: no id, no address, no user agent. `visits` counts a tab opening the game once;
-- `new_browsers` counts the ones that had never opened it before (the browser says so; nothing identifies which).
-- Who is on the site right now is kept in the game server's memory only and is never written here.
-- The game server is the only reader and writer.

create table if not exists site_visits (
  day           text   primary key check (day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  visits        bigint not null default 0 check (visits >= 0),
  new_browsers  bigint not null default 0 check (new_browsers >= 0)
);

alter table site_visits enable row level security;

-- Only the game server reads or writes it: the browser roles get nothing.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on site_visits from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on site_visits from authenticated;
  end if;
end $$;
