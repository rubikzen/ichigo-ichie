-- Ichigo Ichie V446 — Pickup staff workflow e-mail notification
-- Persistent marker prevents duplicate employee alerts on Stripe retries.

alter table public.orders
  add column if not exists pickup_staff_notification_sent_at timestamptz;
