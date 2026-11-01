-- Child-safety reports: the evidence package and where it was sent. Owned by the trust lane.
-- Reports are never deleted (legal hold). Only the reporting process and named moderators may read this table.
create table if not exists child_safety_reports (
  id            text primary key,
  item_id       bigint not null unique,
  status        text   not null,
  reporter      text,
  country       text,
  created_at    bigint not null,
  updated_at    bigint not null,
  content_hash  text   not null,
  legal_hold    boolean not null default true,
  report        jsonb  not null
);
create index if not exists child_safety_reports_status_idx on child_safety_reports (status);

alter table child_safety_reports enable row level security;

-- Refuse deletes and truncates outright.
create or replace function child_safety_reports_no_delete() returns trigger as $$
begin
  raise exception 'child_safety_reports rows cannot be deleted';
end;
$$ language plpgsql;
drop trigger if exists child_safety_reports_no_delete_row on child_safety_reports;
create trigger child_safety_reports_no_delete_row before delete on child_safety_reports
  for each row execute function child_safety_reports_no_delete();
drop trigger if exists child_safety_reports_no_truncate on child_safety_reports;
create trigger child_safety_reports_no_truncate before truncate on child_safety_reports
  for each statement execute function child_safety_reports_no_delete();

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on child_safety_reports from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on child_safety_reports from authenticated;
  end if;
end $$;
