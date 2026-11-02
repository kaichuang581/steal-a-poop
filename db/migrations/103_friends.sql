-- Friends. Owned by the accounts lane.
-- People are found by a private friend code that a player shares themselves, never by searching names, so a stranger cannot
-- look children up. A code can be changed at any time.

create table if not exists friend_codes (
  user_id  text primary key,
  code     text not null unique
);

-- One row per pair, with the two ids in alphabetical order (low < high), so a pair can only exist once.
create table if not exists friendships (
  low_id        text   not null,
  high_id       text   not null,
  requested_by  text   not null,
  status        text   not null,       -- pending | accepted
  created_at    bigint not null,
  updated_at    bigint not null,
  primary key (low_id, high_id),
  check (low_id < high_id)
);
create index if not exists friendships_high_idx on friendships (high_id);

alter table friend_codes  enable row level security;
alter table friendships   enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on friend_codes, friendships from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on friend_codes, friendships from authenticated;
  end if;
end $$;
