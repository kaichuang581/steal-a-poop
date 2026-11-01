-- Personal block lists: who each player has blocked. Owned by the trust lane.
-- Users are text ids with no foreign key to another lane's table. Account deletion should remove
-- rows where blocker = the deleted user; rows where blocked = them can stay or go (no personal data).
create table if not exists user_blocks (
  blocker  text   not null,
  blocked  text   not null,
  at       bigint not null,
  primary key (blocker, blocked)
);
create index if not exists user_blocks_blocked_idx on user_blocks (blocked);

alter table user_blocks enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on user_blocks from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on user_blocks from authenticated;
  end if;
end $$;
