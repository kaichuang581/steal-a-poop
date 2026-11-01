-- Moderation audit log: who did what, and when. Owned by the trust lane. Append-only.
-- Holds ids, verdicts and moderator-written reasons. It never holds the text of a chat message.
create table if not exists moderation_audit (
  id        bigserial primary key,
  at        bigint not null,
  actor     text   not null,   -- a moderator's user id, 'system' (filter, timers) or 'reviewer' (the automatic review)
  action    text   not null,
  item_id   bigint,
  user_id   text,
  details   jsonb  not null default '{}'::jsonb
);
create index if not exists moderation_audit_item_idx on moderation_audit (item_id);
create index if not exists moderation_audit_user_idx on moderation_audit (user_id);
create index if not exists moderation_audit_at_idx   on moderation_audit (at);

create or replace function moderation_audit_immutable() returns trigger as $$
begin
  raise exception 'moderation_audit is append-only';
end;
$$ language plpgsql;
drop trigger if exists moderation_audit_no_change on moderation_audit;
create trigger moderation_audit_no_change before update or delete on moderation_audit
  for each row execute function moderation_audit_immutable();
drop trigger if exists moderation_audit_no_truncate on moderation_audit;
create trigger moderation_audit_no_truncate before truncate on moderation_audit
  for each statement execute function moderation_audit_immutable();

alter table moderation_audit enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on moderation_audit from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on moderation_audit from authenticated;
  end if;
end $$;
