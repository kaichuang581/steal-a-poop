-- Moderation state: who is suspended or banned, the review queue, and restricted evidence.
-- Owned by the trust lane. Times are epoch milliseconds. Users are referred to by text user_id with
-- no foreign key to another lane's table.

create table if not exists moderation_standings (
  user_id          text primary key,
  banned           boolean not null default false,
  suspended_until  bigint,
  updated_at       bigint not null
);

create table if not exists moderation_items (
  id          bigint primary key,
  at          bigint not null,
  user_id     text   not null,
  room_code   text   not null,
  category    text   not null,
  status      text   not null,
  verdict     text,
  data        jsonb  not null,
  updated_at  bigint not null
);
create index if not exists moderation_items_status_idx on moderation_items (status);
create index if not exists moderation_items_user_idx   on moderation_items (user_id);

-- Evidence: the held message or report with its context, captured when it happens.
-- Append-only. The trigger below refuses UPDATE, DELETE and TRUNCATE. A database superuser can still
-- disable triggers, so access to this table must be limited to the reporting process and named moderators.
create table if not exists moderation_evidence (
  id            bigserial primary key,
  item_id       bigint not null,
  user_id       text   not null,
  captured_at   bigint not null,
  content_hash  text   not null,
  payload       jsonb  not null
);
create index if not exists moderation_evidence_item_idx on moderation_evidence (item_id);
create index if not exists moderation_evidence_user_idx on moderation_evidence (user_id);

create or replace function moderation_evidence_immutable() returns trigger as $$
begin
  raise exception 'moderation_evidence is append-only';
end;
$$ language plpgsql;

drop trigger if exists moderation_evidence_no_change on moderation_evidence;
create trigger moderation_evidence_no_change
  before update or delete on moderation_evidence
  for each row execute function moderation_evidence_immutable();

drop trigger if exists moderation_evidence_no_truncate on moderation_evidence;
create trigger moderation_evidence_no_truncate
  before truncate on moderation_evidence
  for each statement execute function moderation_evidence_immutable();

-- Row-level security with NO policies: ordinary roles see nothing. Only the table owner and roles that
-- bypass RLS (the service role) can read or write. Nothing here is meant to be reached from a browser.
alter table moderation_standings enable row level security;
alter table moderation_items     enable row level security;
alter table moderation_evidence  enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on moderation_standings, moderation_items, moderation_evidence from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on moderation_standings, moderation_items, moderation_evidence from authenticated;
  end if;
end $$;
