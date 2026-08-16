-- Ichigo Ichie V4.33 — Pickup lifecycle customer emails
-- Delivery markers keep automatic pickup status emails idempotent and auditable.
-- Existing orders remain NULL and are not emailed retroactively.

alter table public.orders
  add column if not exists pickup_preparing_email_sent_at timestamptz,
  add column if not exists pickup_ready_email_sent_at timestamptz,
  add column if not exists pickup_completed_email_sent_at timestamptz;

comment on column public.orders.pickup_preparing_email_sent_at is
  'Customer email sent when a pickup order enters preparing.';
comment on column public.orders.pickup_ready_email_sent_at is
  'Customer email sent when a pickup order becomes ready for collection.';
comment on column public.orders.pickup_completed_email_sent_at is
  'Customer email sent after a pickup order is handed to the customer.';
