-- The Barn Bazaar's wallet for signed-in players (Wool Coins, XP, owned and worn cosmetics, the words played).
-- Owned by the accounts lane. One row per player, the whole wallet as JSON, read and written in one locked
-- transaction by the game server. Nothing here is bought with money: every item is cosmetic and earned or bought with
-- Wool Coins. `imported` is set once the player's first device has brought its browser wallet in.

create table if not exists barn_wallets (
  user_id     text primary key,
  wallet      jsonb   not null,
  imported    boolean not null default false,
  updated_at  bigint  not null
);

alter table barn_wallets enable row level security;

-- Only the game server reads or writes it: the browser roles get nothing.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on barn_wallets from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on barn_wallets from authenticated;
  end if;
end $$;
