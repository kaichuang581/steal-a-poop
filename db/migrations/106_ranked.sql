-- Ranked play: one rating per signed-in player. Owned by the accounts lane.
-- `rating` is the points on the ladder (src/lib/ranked.ts): 0 is Lamb I, every 100 a division, 2100 the last rank.
-- A row is written when a player finishes their first ranked game; the game server is the only writer, and it only
-- writes when a ranked game it ran itself is over. `peak` is the highest the rating has been.

create table if not exists ranked_ratings (
  user_id     text primary key,
  rating      integer not null default 0 check (rating >= 0),
  games       integer not null default 0 check (games >= 0),
  wins        integer not null default 0 check (wins >= 0),
  peak        integer not null default 0 check (peak >= 0),
  updated_at  bigint  not null
);

-- The board reads the highest ratings.
create index if not exists ranked_ratings_by_rating on ranked_ratings (rating desc, user_id) where games > 0;

alter table ranked_ratings enable row level security;

-- Only the game server reads or writes it: the browser roles get nothing.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on ranked_ratings from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on ranked_ratings from authenticated;
  end if;
end $$;
