-- Ichigo Ichie V2.43 — Espace client
-- Passwordless Supabase Auth + verified-email order claiming + RLS.

create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists idx_orders_customer_id_created
  on public.orders(customer_id, created_at desc);
create index if not exists idx_orders_customer_email_lower
  on public.orders(lower(customer_email));

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Maison',
  address1 text not null,
  address2 text,
  postal_code text not null,
  city text not null,
  country text not null default 'FR',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_address_postal_fr check (postal_code ~ '^[0-9]{5}$'),
  constraint customer_address_country_fr check (country = 'FR')
);

create index if not exists idx_customer_addresses_owner
  on public.customer_addresses(customer_id, is_default desc, created_at desc);

-- At most one default address per customer.
create unique index if not exists idx_customer_addresses_one_default
  on public.customer_addresses(customer_id)
  where is_default = true;

-- Reuse the project's generic updated_at helper when available.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_customer_profiles_updated_at on public.customer_profiles;
    create trigger trg_customer_profiles_updated_at before update on public.customer_profiles
      for each row execute function public.set_updated_at();
    drop trigger if exists trg_customer_addresses_updated_at on public.customer_addresses;
    create trigger trg_customer_addresses_updated_at before update on public.customer_addresses
      for each row execute function public.set_updated_at();
  end if;
end $$;

grant select, insert, update on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select on public.orders, public.order_items to authenticated;

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Customer profile: only the authenticated owner.
drop policy if exists "customers read own profile" on public.customer_profiles;
create policy "customers read own profile" on public.customer_profiles
  for select to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists "customers insert own profile" on public.customer_profiles;
create policy "customers insert own profile" on public.customer_profiles
  for insert to authenticated
  with check ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists "customers update own profile" on public.customer_profiles;
create policy "customers update own profile" on public.customer_profiles
  for update to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()))
  with check ((select auth.uid()) is not null and id = (select auth.uid()));

-- Saved addresses: only the authenticated owner.
drop policy if exists "customers read own addresses" on public.customer_addresses;
create policy "customers read own addresses" on public.customer_addresses
  for select to authenticated
  using ((select auth.uid()) is not null and customer_id = (select auth.uid()));

drop policy if exists "customers insert own addresses" on public.customer_addresses;
create policy "customers insert own addresses" on public.customer_addresses
  for insert to authenticated
  with check ((select auth.uid()) is not null and customer_id = (select auth.uid()));

drop policy if exists "customers update own addresses" on public.customer_addresses;
create policy "customers update own addresses" on public.customer_addresses
  for update to authenticated
  using ((select auth.uid()) is not null and customer_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and customer_id = (select auth.uid()));

drop policy if exists "customers delete own addresses" on public.customer_addresses;
create policy "customers delete own addresses" on public.customer_addresses
  for delete to authenticated
  using ((select auth.uid()) is not null and customer_id = (select auth.uid()));

-- Existing admin policies remain untouched. This adds customer read access only.
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders
  for select to authenticated
  using ((select auth.uid()) is not null and customer_id = (select auth.uid()));

create or replace function public.customer_owns_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.orders o
    where o.id = target_order_id
      and o.customer_id = auth.uid()
  );
$$;

revoke all on function public.customer_owns_order(uuid) from public;
grant execute on function public.customer_owns_order(uuid) to authenticated;

drop policy if exists "customers read own order items" on public.order_items;
create policy "customers read own order items" on public.order_items
  for select to authenticated
  using (public.customer_owns_order(order_id));

-- Safely associates guest orders with a customer. The email is NEVER accepted
-- as an argument: it is read from auth.users and must already be verified.
create or replace function public.claim_customer_orders()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_claimed integer := 0;
  v_first_name text := '';
  v_last_name text := '';
  v_phone text := '';
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select lower(trim(u.email))
    into v_email
  from auth.users u
  where u.id = v_uid
    and u.email is not null
    and u.email_confirmed_at is not null;

  if v_email is null or v_email = '' then
    raise exception 'verified email required';
  end if;

  update public.orders
     set customer_id = v_uid
   where customer_id is null
     and lower(trim(customer_email)) = v_email;
  get diagnostics v_claimed = row_count;

  select coalesce(o.customer_first_name, ''),
         coalesce(o.customer_last_name, ''),
         coalesce(o.customer_phone, '')
    into v_first_name, v_last_name, v_phone
  from public.orders o
  where o.customer_id = v_uid
  order by o.created_at desc
  limit 1;

  insert into public.customer_profiles(id, first_name, last_name, phone)
  values (v_uid, coalesce(v_first_name, ''), coalesce(v_last_name, ''), coalesce(v_phone, ''))
  on conflict (id) do update set
    first_name = case when public.customer_profiles.first_name = '' then excluded.first_name else public.customer_profiles.first_name end,
    last_name = case when public.customer_profiles.last_name = '' then excluded.last_name else public.customer_profiles.last_name end,
    phone = case when public.customer_profiles.phone = '' then excluded.phone else public.customer_profiles.phone end;

  return v_claimed;
end;
$$;

revoke all on function public.claim_customer_orders() from public;
grant execute on function public.claim_customer_orders() to authenticated;
