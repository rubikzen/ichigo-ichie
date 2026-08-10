-- Ichigo Ichie V2.42.2
-- Restore the source_channel column expected by the current order flow.
-- Existing legacy orders are intentionally left NULL so they are not
-- incorrectly counted as current Boutique orders.

alter table public.orders
  add column if not exists source_channel text;

create index if not exists orders_source_channel_created_at_idx
  on public.orders (source_channel, created_at desc);

comment on column public.orders.source_channel is
  'Origin of the order flow. Current Boutique checkout writes shop; legacy rows may remain NULL.';
