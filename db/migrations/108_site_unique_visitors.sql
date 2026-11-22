-- Unique visitors for the admin panel's numbers (Brian, 2026-11-21: "in the stats key you also see UNIQUE website
-- visitors and not just total visits"). Three more counters a UTC day, still with nothing about a person: the browser
-- keeps the day of its own last visit and says, when a tab opens, whether this is its first visit of the day, of the
-- week (weeks start on Monday, UTC) and of the month. Summing a period's days of the matching counter gives how many
-- browsers visited in it. No id is sent or stored.

alter table site_visits add column if not exists unique_day   bigint not null default 0 check (unique_day >= 0);
alter table site_visits add column if not exists unique_week  bigint not null default 0 check (unique_week >= 0);
alter table site_visits add column if not exists unique_month bigint not null default 0 check (unique_month >= 0);
