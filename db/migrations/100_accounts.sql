-- Accounts: player profiles, parental consent records, banned identities and revoked sessions.
-- Owned by the accounts lane. Sign-in itself (passwords, email verification, Google/Meta) is handled by
-- Supabase Auth; these tables hold only what the game needs. Users are referred to by text user_id (the
-- Supabase auth user id) with no foreign key, so the file also runs on a plain Postgres for tests.
-- Times are epoch milliseconds. Row-level security is on with no policies: only the service role
-- (the game server) can read or write.

create table if not exists profiles (
  user_id              text primary key,
  nickname             text not null,
  -- sha256 of the normalised sign-up email. Lets us refuse a banned person's email without storing the address here.
  email_hash           text not null,
  date_of_birth        date,                 -- null after account deletion
  country              text,                 -- ISO 3166-1 alpha-2; null after account deletion
  -- not_required: old enough to agree alone. pending/granted/refused/withdrawn: under the age of digital consent.
  consent_status       text not null default 'not_required',
  is_moderator         boolean not null default false,   -- set by hand with SQL; never from the client
  -- Tokens issued before this moment are refused. "Log out everywhere" sets it to now.
  sessions_valid_after bigint not null default 0,
  created_at           bigint not null,
  updated_at           bigint not null,
  deleted_at           bigint
);
create unique index if not exists profiles_nickname_live_idx on profiles (lower(nickname)) where deleted_at is null;
create index if not exists profiles_email_hash_idx on profiles (email_hash);

-- Parental consent records. Kept after the child's account is deleted unless the lawyer says otherwise
-- (they are the proof that consent was asked for and given). Rows cannot be deleted.
create table if not exists parental_consents (
  id                  text primary key,
  child_user_id       text   not null,
  parent_email        text   not null,
  request_token_hash  text   not null unique,   -- sha256 of the token in the email; the token itself is never stored
  manage_token_hash   text unique,              -- set when consent is granted; lets the parent withdraw later
  policy_version      text   not null,
  notice_hash         text   not null,          -- sha256 of the exact notice text shown to the parent
  method              text   not null default 'email_link',
  requested_at        bigint not null,
  expires_at          bigint not null,
  decided_at          bigint,
  decision            text                       -- granted | refused | withdrawn
);
create index if not exists parental_consents_child_idx on parental_consents (child_user_id);

create or replace function parental_consents_no_delete() returns trigger as $$
begin
  raise exception 'parental_consents rows cannot be deleted';
end;
$$ language plpgsql;
drop trigger if exists parental_consents_no_delete_row on parental_consents;
create trigger parental_consents_no_delete_row before delete on parental_consents
  for each row execute function parental_consents_no_delete();
drop trigger if exists parental_consents_no_truncate on parental_consents;
create trigger parental_consents_no_truncate before truncate on parental_consents
  for each statement execute function parental_consents_no_delete();

-- A banned person's identity (hash of the normalised email), so the same address cannot sign up again.
create table if not exists banned_identities (
  identity_hash   text primary key,
  reason          text   not null,
  banned_at       bigint not null,
  source_user_id  text   not null
);

-- Sessions ended by "log out". The access token stays cryptographically valid until it expires, so the
-- server refuses any token whose session id is listed here. Rows may be purged after expires_at.
create table if not exists revoked_sessions (
  session_id  text primary key,
  user_id     text   not null,
  revoked_at  bigint not null,
  expires_at  bigint not null
);
create index if not exists revoked_sessions_expires_idx on revoked_sessions (expires_at);

alter table profiles            enable row level security;
alter table parental_consents   enable row level security;
alter table banned_identities   enable row level security;
alter table revoked_sessions    enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on profiles, parental_consents, banned_identities, revoked_sessions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on profiles, parental_consents, banned_identities, revoked_sessions from authenticated;
  end if;
end $$;
