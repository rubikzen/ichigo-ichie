-- Ichigo Ichie V448 — Supabase Security Advisor hardening
--
-- Goals:
-- 1. Persist the production RLS fix for invoice_counters.
-- 2. Remove broad object-listing policies from public Storage buckets while
--    keeping public file URLs functional and authenticated admin listing intact.
-- 3. Remove unnecessary SECURITY DEFINER exposure from helper functions.
-- 4. Revoke direct client execution of internal trigger functions.
-- 5. Keep claim_customer_orders() callable only by signed-in customers because
--    it intentionally claims guest orders using the caller's verified auth email.
--
-- This migration deliberately does NOT add RLS policies to api_rate_limits or
-- invoice_counters. They are internal tables and "RLS Enabled No Policy" is the
-- intended deny-by-default state for anon/authenticated clients.

begin;

-- ---------------------------------------------------------------------------
-- Internal tables: deny-by-default from browser roles.
-- ---------------------------------------------------------------------------
alter table public.invoice_counters enable row level security;

revoke all privileges
  on table public.invoice_counters
  from anon, authenticated;

grant select, insert, update, delete
  on table public.invoice_counters
  to service_role;

-- ---------------------------------------------------------------------------
-- Generic trigger helper: fixed search_path + no direct RPC execution.
-- ---------------------------------------------------------------------------
alter function public.set_updated_at()
  set search_path = public;

revoke execute
  on function public.set_updated_at()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin identity helpers no longer need SECURITY DEFINER.
--
-- authenticated already has SELECT on public.admins and the table's RLS policy
-- only exposes the caller's own row, so SECURITY INVOKER is sufficient.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists(
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$$;

revoke all
  on function public.is_admin()
  from public, anon, authenticated;

grant execute
  on function public.is_admin()
  to authenticated;

create or replace function public.is_ichigo_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists(
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$$;

revoke all
  on function public.is_ichigo_admin()
  from public, anon, authenticated;

grant execute
  on function public.is_ichigo_admin()
  to authenticated;

-- Anonymous catalog reads must never need to execute an admin helper.
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories"
  on public.categories
  for select
  to anon, authenticated
  using (active);

drop policy if exists "public read active products" on public.products;
create policy "public read active products"
  on public.products
  for select
  to anon, authenticated
  using (active);

drop policy if exists "public read active variants" on public.product_variants;
create policy "public read active variants"
  on public.product_variants
  for select
  to anon, authenticated
  using (active);

drop policy if exists "public read active option values" on public.option_values;
create policy "public read active option values"
  on public.option_values
  for select
  to anon, authenticated
  using (active);

-- Authenticated admins retain visibility of inactive catalog records.
drop policy if exists "admins read all categories" on public.categories;
create policy "admins read all categories"
  on public.categories
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins read all products" on public.products;
create policy "admins read all products"
  on public.products
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins read all variants" on public.product_variants;
create policy "admins read all variants"
  on public.product_variants
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins read all option values" on public.option_values;
create policy "admins read all option values"
  on public.option_values
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Customer ownership helper can also run as the caller.
-- The orders table already has customer/admin RLS policies.
-- ---------------------------------------------------------------------------
create or replace function public.customer_owns_order(target_order_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists(
    select 1
    from public.orders o
    where o.id = target_order_id
      and o.customer_id = auth.uid()
  );
$$;

revoke all
  on function public.customer_owns_order(uuid)
  from public, anon, authenticated;

grant execute
  on function public.customer_owns_order(uuid)
  to authenticated;

-- claim_customer_orders() intentionally remains SECURITY DEFINER because it
-- reads auth.users to verify the caller's confirmed email before claiming old
-- guest orders. It accepts no email/user-id argument from the browser.
-- Explicitly block anonymous/public execution and keep signed-in access only.
revoke execute
  on function public.claim_customer_orders()
  from public, anon;

grant execute
  on function public.claim_customer_orders()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Public Storage buckets:
-- Public URL delivery remains controlled by the bucket's public=true setting.
-- Broad storage.objects SELECT policies are unnecessary for visitors and allow
-- bucket listing. Keep SELECT only for authenticated admins who need media UI.
-- ---------------------------------------------------------------------------
drop policy if exists "public read product images" on storage.objects;
drop policy if exists "public read site media" on storage.objects;

drop policy if exists "admins read product image objects" on storage.objects;
create policy "admins read product image objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.is_admin()
  );

drop policy if exists "admins read site media objects" on storage.objects;
create policy "admins read site media objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'site-media'
    and public.is_admin()
  );

-- Keep both buckets public for existing public URLs.
update storage.buckets
set public = true
where id in ('product-images', 'site-media');

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER trigger functions are internal implementation details.
-- Revoke direct browser execution without changing trigger behavior.
-- This also safely covers future/current public-schema SECURITY DEFINER
-- trigger functions instead of relying on a fragile name list.
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      fn.signature
    );
  end loop;
end
$$;

-- Explicit names document the two Security Advisor findings already present
-- in this project. The dynamic block above is the actual future-proof guard.
revoke execute
  on function public.release_promo_before_order_delete()
  from public, anon, authenticated;

revoke execute
  on function public.sync_order_stock_on_status()
  from public, anon, authenticated;

commit;
