-- Ichigo Ichie V2.37 — internal order email notification marker
alter table public.orders
  add column if not exists merchant_notification_sent_at timestamptz;

comment on column public.orders.merchant_notification_sent_at is
  'Timestamp of the internal paid-order notification email, used to avoid duplicates.';
