-- Remembers, for a limited time, the email of an account that was deleted while it was suspended or had a moderation case open,
-- so deleting the account does not wipe the suspension. Only a one-way hash of the normalised email is kept (never the address),
-- and the row expires: when the suspension would have ended, or after a short hold for an open case. It is removed early if a person
-- clears the case. Bans are different and permanent (banned_identities). Owned by the accounts lane.
create table if not exists restricted_identities (
  identity_hash   text primary key,
  reason          text   not null,         -- suspension | open_case
  restricted_until bigint not null,         -- epoch ms; after this the row is meaningless and is purged
  created_at      bigint not null,
  source_user_id  text   not null           -- the deleted account, so clearing its case can lift this
);
create index if not exists restricted_identities_until_idx on restricted_identities (restricted_until);
create index if not exists restricted_identities_source_idx on restricted_identities (source_user_id);

alter table restricted_identities enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on restricted_identities from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on restricted_identities from authenticated;
  end if;
end $$;
