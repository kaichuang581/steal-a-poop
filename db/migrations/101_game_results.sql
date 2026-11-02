-- Finished games and who played them, for stats and leaderboards. Owned by the accounts lane.
-- Users are text ids with no foreign key to another lane's table. Times are epoch ms. Row-level security is on with no policies:
-- only the game server reads and writes.

create table if not exists games (
  game_id       text primary key,
  mode          text   not null,          -- room | daily
  room_code     text,
  daily_date    date,
  finished_at   bigint not null,
  player_count  int    not null,
  human_count   int    not null
);
create index if not exists games_finished_idx on games (finished_at);
create index if not exists games_daily_idx on games (daily_date) where mode = 'daily';

create table if not exists game_players (
  game_id       text not null references games (game_id),
  seat          int  not null,
  -- null for a bot, and for a player whose results are not stored (a child without a parent's consent) or who deleted their account
  user_id       text,
  display_name  text not null,
  banked        int  not null,
  steals        int  not null,
  words_played  int  not null,
  longest_word  text not null,
  won           boolean not null,
  primary key (game_id, seat)
);
create index if not exists game_players_user_idx on game_players (user_id, game_id) where user_id is not null;

-- Players choose whether they appear on public leaderboards. Anyone who needed a parent's consent starts hidden.
alter table profiles add column if not exists leaderboard_visible boolean not null default true;

-- One Daily Table attempt per player per UTC day.
create table if not exists daily_attempts (
  user_id     text not null,
  daily_date  date not null,
  at          bigint not null,
  primary key (user_id, daily_date)
);

alter table games           enable row level security;
alter table game_players    enable row level security;
alter table daily_attempts  enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on games, game_players, daily_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on games, game_players, daily_attempts from authenticated;
  end if;
end $$;
