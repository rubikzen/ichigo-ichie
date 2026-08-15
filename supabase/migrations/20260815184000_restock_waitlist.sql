-- Ichigo Ichie V4.25 — restock waitlist foundation
-- Public visitors subscribe through the service-role API only.
-- Authenticated admins can read the waitlist; anon users can never enumerate emails.

create table if not exists public.restock_subscriptions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  email text not null,
  locale text not null default 'fr' check (locale in ('fr','en')),
  status text not null default 'active' check (status in ('active','notified','cancelled')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  cancelled_at timestamptz,
  check (char_length(email) between 3 and 254)
);

create unique index if not exists uq_restock_active_target_email
  on public.restock_subscriptions (
    product_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(email)
  )
  where status = 'active';

create index if not exists idx_restock_active_created
  on public.restock_subscriptions(status, created_at desc);

create index if not exists idx_restock_product_active
  on public.restock_subscriptions(product_id, status);

alter table public.restock_subscriptions enable row level security;

revoke all on table public.restock_subscriptions from anon, authenticated;
grant select, update, delete on table public.restock_subscriptions to authenticated;
grant select, insert, update, delete on table public.restock_subscriptions to service_role;

drop policy if exists "admins read restock subscriptions" on public.restock_subscriptions;
create policy "admins read restock subscriptions"
  on public.restock_subscriptions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins update restock subscriptions" on public.restock_subscriptions;
create policy "admins update restock subscriptions"
  on public.restock_subscriptions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete restock subscriptions" on public.restock_subscriptions;
create policy "admins delete restock subscriptions"
  on public.restock_subscriptions
  for delete
  to authenticated
  using (public.is_admin());

comment on table public.restock_subscriptions is
  'Customer-requested back-in-stock notifications. Email is private and admin-only.';
comment on column public.restock_subscriptions.variant_id is
  'Nullable in V4.25; product-level subscriptions are used by the storefront.';
