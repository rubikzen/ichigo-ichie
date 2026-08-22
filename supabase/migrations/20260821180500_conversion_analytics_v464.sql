-- V464 — persisted, privacy-conscious first-party conversion analytics.
-- Contains no customer identity, contact data, address, IP or user-agent.

create table if not exists public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  event text not null check (event in ('product_view', 'add_to_cart', 'begin_checkout', 'purchase')),
  session_id text not null check (char_length(session_id) between 1 and 80),
  occurred_at timestamptz not null default now(),
  path text not null default '/',
  currency text null check (currency is null or currency = 'EUR'),
  product_id text null,
  variant_id text null,
  source text null check (source is null or source in ('product_page', 'product_modal')),
  order_type text null check (order_type is null or order_type in ('pickup', 'shipping')),
  value numeric(12,2) null check (value is null or value >= 0),
  quantity integer null check (quantity is null or quantity >= 0),
  item_count integer null check (item_count is null or item_count >= 0),
  transaction_ref text null,
  created_at timestamptz not null default now()
);

create index if not exists conversion_events_occurred_at_idx
  on public.conversion_events (occurred_at desc);
create index if not exists conversion_events_event_occurred_idx
  on public.conversion_events (event, occurred_at desc);
create index if not exists conversion_events_product_occurred_idx
  on public.conversion_events (product_id, occurred_at desc)
  where product_id is not null;
create unique index if not exists conversion_events_purchase_ref_uidx
  on public.conversion_events (transaction_ref)
  where event = 'purchase' and transaction_ref is not null;

alter table public.conversion_events enable row level security;

-- Server/service-role only. Admin reads go through an authenticated server route.
revoke all on table public.conversion_events from anon, authenticated;
grant select, insert on table public.conversion_events to service_role;
