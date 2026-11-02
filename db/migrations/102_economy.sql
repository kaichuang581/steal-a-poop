-- Coins and the cosmetic shop. Owned by the accounts lane.
-- Coins are earned by playing and spent on cosmetic items only. They cannot be bought with money, sent to another player, or
-- exchanged for anything outside the game. The ledger is the record; the wallet is its running total and can never go below zero.

create table if not exists wallets (
  user_id  text primary key,
  balance  bigint not null default 0 check (balance >= 0)
);

create table if not exists wallet_ledger (
  id        bigserial primary key,
  user_id   text   not null,
  delta     bigint not null,
  reason    text   not null,          -- game_reward | daily_reward | purchase | adjustment
  ref       text   not null,          -- the game id, the item id, or a note: stops the same reward being paid twice
  at        bigint not null,
  unique (user_id, reason, ref)
);
create index if not exists wallet_ledger_user_idx on wallet_ledger (user_id, at);

create or replace function wallet_ledger_immutable() returns trigger as $$
begin
  raise exception 'wallet_ledger is append-only';
end;
$$ language plpgsql set search_path = '';
drop trigger if exists wallet_ledger_no_change on wallet_ledger;
create trigger wallet_ledger_no_change before update or delete on wallet_ledger
  for each row execute function wallet_ledger_immutable();
drop trigger if exists wallet_ledger_no_truncate on wallet_ledger;
create trigger wallet_ledger_no_truncate before truncate on wallet_ledger
  for each statement execute function wallet_ledger_immutable();

create table if not exists inventory (
  user_id     text   not null,
  item_id     text   not null,
  price_paid  bigint not null,
  at          bigint not null,
  primary key (user_id, item_id)
);

-- What a player has put on: one item per slot (color, title, badge, theme).
create table if not exists equipped (
  user_id  text not null,
  slot     text not null,
  item_id  text not null,
  primary key (user_id, slot)
);

alter table wallets        enable row level security;
alter table wallet_ledger  enable row level security;
alter table inventory      enable row level security;
alter table equipped       enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on wallets, wallet_ledger, inventory, equipped from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on wallets, wallet_ledger, inventory, equipped from authenticated;
  end if;
end $$;
