-- Ichigo Ichie V2.42.3 — comprehensive orders schema repair
-- Safe/idempotent repair for projects that missed one or more historical migrations.
-- No existing order is deleted.

-- Shipping / fulfilment fields (V2.2+)
alter table public.orders
  add column if not exists shipping_method_id text,
  add column if not exists shipping_method_name text,
  add column if not exists shipping_address1 text,
  add column if not exists shipping_address2 text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_city text,
  add column if not exists shipping_country text,
  add column if not exists package_weight_g integer not null default 0,
  add column if not exists stock_reserved boolean not null default false;

-- Order source (V2.14+). Keep legacy rows NULL; new checkout explicitly writes 'shop'.
alter table public.orders
  add column if not exists source_channel text;

-- Stripe payment state (V2.17+).
alter table public.orders
  add column if not exists payment_method text not null default 'pickup',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_expires_at timestamptz;

-- Promo fields (V2.34+). promo_code_id is deliberately added without a hard FK
-- here so this repair remains safe even if the promo migration is applied later.
alter table public.orders
  add column if not exists promo_code_id uuid,
  add column if not exists promo_code text,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists promo_reserved boolean not null default false,
  add column if not exists promo_redeemed_at timestamptz;

-- Production / tracking / legal acceptance / email markers (V2.27+ / V2.37+).
alter table public.orders
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists shipping_email_sent_at timestamptz,
  add column if not exists refund_email_sent_at timestamptz,
  add column if not exists merchant_notification_sent_at timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

-- Normalize obviously invalid nullable numeric data before constraints/indexes.
update public.orders set package_weight_g = 0 where package_weight_g is null or package_weight_g < 0;
update public.orders set discount_amount = 0 where discount_amount is null or discount_amount < 0;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('online','pickup'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in (
    'unpaid','pending','paid','refunded','refund_pending','refund_failed','failed','expired'
  ));

alter table public.orders drop constraint if exists orders_source_channel_check;
alter table public.orders add constraint orders_source_channel_check
  check (source_channel is null or source_channel in ('menu','shop','mixed'));

alter table public.orders drop constraint if exists orders_discount_amount_check;
alter table public.orders add constraint orders_discount_amount_check
  check (discount_amount >= 0);

-- Indexes expected by payment/admin/statistics flows.
create unique index if not exists idx_orders_stripe_checkout_session
  on public.orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists idx_orders_payment_status
  on public.orders(payment_status, created_at desc);

create index if not exists orders_source_channel_created_at_idx
  on public.orders(source_channel, created_at desc);

create index if not exists idx_orders_promo_code_id
  on public.orders(promo_code_id)
  where promo_code_id is not null;

create index if not exists idx_orders_tracking_number
  on public.orders(tracking_number)
  where tracking_number is not null;

create unique index if not exists idx_orders_stripe_refund
  on public.orders(stripe_refund_id)
  where stripe_refund_id is not null;

-- Restore the stock reservation RPCs if the V2.9 migration was missed.
create or replace function public.reserve_shop_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved boolean;
  r record;
  v_updated integer;
begin
  select stock_reserved into v_reserved
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ICHIGO_ORDER_NOT_FOUND';
  end if;
  if v_reserved then
    return;
  end if;

  for r in
    select oi.product_id, oi.variant_id, oi.quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.categories c on c.id = p.category_id
    where oi.order_id = p_order_id
      and c.kind = 'shop'
    order by oi.product_id, oi.variant_id nulls first
  loop
    if r.variant_id is not null then
      update public.product_variants
      set stock = stock - r.quantity
      where id = r.variant_id
        and product_id = r.product_id
        and active = true
        and stock >= r.quantity;
      get diagnostics v_updated = row_count;
    else
      update public.products
      set stock = stock - r.quantity
      where id = r.product_id
        and active = true
        and stock >= r.quantity;
      get diagnostics v_updated = row_count;
    end if;

    if v_updated <> 1 then
      raise exception 'ICHIGO_STOCK_INSUFFICIENT';
    end if;
  end loop;

  update public.orders set stock_reserved = true where id = p_order_id;
end;
$$;

create or replace function public.release_shop_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved boolean;
  r record;
begin
  select stock_reserved into v_reserved
  from public.orders
  where id = p_order_id
  for update;

  if not found or not v_reserved then
    return;
  end if;

  for r in
    select oi.product_id, oi.variant_id, oi.quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.categories c on c.id = p.category_id
    where oi.order_id = p_order_id
      and c.kind = 'shop'
  loop
    if r.variant_id is not null then
      update public.product_variants
      set stock = stock + r.quantity
      where id = r.variant_id and product_id = r.product_id;
    else
      update public.products
      set stock = stock + r.quantity
      where id = r.product_id;
    end if;
  end loop;

  update public.orders set stock_reserved = false where id = p_order_id;
end;
$$;

revoke all on function public.reserve_shop_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.release_shop_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.reserve_shop_order_stock(uuid) to service_role;
grant execute on function public.release_shop_order_stock(uuid) to service_role;

comment on column public.orders.source_channel is
  'Origin of order flow. Current Boutique checkout writes shop; legacy rows may remain NULL.';
comment on column public.orders.payment_method is
  'online = Stripe; pickup = legacy payment-at-pickup orders.';
