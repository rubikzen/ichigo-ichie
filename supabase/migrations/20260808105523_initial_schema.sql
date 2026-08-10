-- Ichigo Ichie V2 — Supabase schema
-- Run this file once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.admins where user_id = auth.uid()); $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_fr text not null,
  name_en text not null,
  kind text not null check (kind in ('menu','shop')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  type text not null check (type in ('product','drink','dessert','accessory','combo')),
  name_fr text not null,
  name_en text not null,
  description_fr text not null default '',
  description_en text not null default '',
  long_description_fr text,
  long_description_en text,
  origin text,
  cultivar text,
  badge text,
  base_price numeric(10,2) not null default 0 check (base_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  pickup_only boolean not null default false,
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  image_url text,
  ideal_for text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  packaging text check (packaging in ('can','bag','other')),
  weight text,
  price numeric(10,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  sku text unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.option_groups (
  id uuid primary key default gen_random_uuid(),
  name_fr text not null,
  name_en text not null,
  required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1,
  check (max_select >= 1 and max_select >= min_select),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.option_values (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.option_groups(id) on delete cascade,
  label_fr text not null,
  label_en text not null,
  price_delta numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_option_groups (
  product_id uuid not null references public.products(id) on delete cascade,
  option_group_id uuid not null references public.option_groups(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, option_group_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  status text not null default 'pending' check (status in ('pending','preparing','ready','completed','cancelled','refunded')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded','failed')),
  order_type text not null default 'pickup' check (order_type in ('pickup','shipping')),
  customer_first_name text not null,
  customer_last_name text not null default '',
  customer_email text not null,
  customer_phone text not null,
  pickup_time timestamptz,
  notes text,
  subtotal numeric(10,2) not null default 0,
  shipping_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  line_total numeric(10,2) not null,
  choices jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category_id, active, sort_order);
create index if not exists idx_variants_product on public.product_variants(product_id, active, sort_order);
create index if not exists idx_option_values_group on public.option_values(option_group_id, active, sort_order);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status, created_at desc);

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','product_variants','option_groups','option_values','orders','site_settings'] LOOP
    EXECUTE format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    EXECUTE format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- Explicit privileges; RLS policies below still decide which rows are accessible.
grant select on public.categories, public.products, public.product_variants, public.option_groups, public.option_values, public.product_option_groups, public.site_settings to anon, authenticated;
grant select, insert, update, delete on public.categories, public.products, public.product_variants, public.option_groups, public.option_values, public.product_option_groups, public.site_settings to authenticated;
grant select on public.admins, public.orders, public.order_items to authenticated;
grant update on public.orders to authenticated;

-- RLS
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.option_groups enable row level security;
alter table public.option_values enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.site_settings enable row level security;

-- Public catalog reads
drop policy if exists "public read active categories" on public.categories;
create policy "public read active categories" on public.categories for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "public read active variants" on public.product_variants;
create policy "public read active variants" on public.product_variants for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "public read option groups" on public.option_groups;
create policy "public read option groups" on public.option_groups for select to anon, authenticated using (true);
drop policy if exists "public read active option values" on public.option_values;
create policy "public read active option values" on public.option_values for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "public read product option joins" on public.product_option_groups;
create policy "public read product option joins" on public.product_option_groups for select to anon, authenticated using (true);
drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings for select to anon, authenticated using (true);

-- Admin identity
drop policy if exists "admins can read own admin row" on public.admins;
create policy "admins can read own admin row" on public.admins for select to authenticated using (user_id = auth.uid());

-- Admin catalog writes
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','product_variants','option_groups','option_values','product_option_groups','site_settings'] LOOP
    EXECUTE format('drop policy if exists "admin insert %s" on public.%I', t, t);
    EXECUTE format('drop policy if exists "admin update %s" on public.%I', t, t);
    EXECUTE format('drop policy if exists "admin delete %s" on public.%I', t, t);
    EXECUTE format('create policy "admin insert %s" on public.%I for insert to authenticated with check (public.is_admin())', t, t);
    EXECUTE format('create policy "admin update %s" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
    EXECUTE format('create policy "admin delete %s" on public.%I for delete to authenticated using (public.is_admin())', t, t);
  END LOOP;
END $$;

-- Orders are written only by the server service-role route. Admins can read/update them.
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders for select to authenticated using (public.is_admin());
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items" on public.order_items for select to authenticated using (public.is_admin());

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects for select to public using (bucket_id = 'product-images');
drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "admins update product images" on storage.objects;
create policy "admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- Default settings
insert into public.site_settings(key,value) values
  ('announcement_fr', to_jsonb('Retrait boutique à Nice · Commande en ligne'::text)),
  ('announcement_en', to_jsonb('Boutique pickup in Nice · Order online'::text)),
  ('free_shipping_threshold', to_jsonb('69'::text)),
  ('phone', to_jsonb(''::text)),
  ('instagram', to_jsonb(''::text)),
  ('opening_hours', to_jsonb('11h–19h'::text))
on conflict (key) do nothing;

-- IMPORTANT: after creating your admin user in Authentication > Users, run:
-- insert into public.admins(user_id)
-- select id from auth.users where email = 'YOUR-ADMIN-EMAIL@example.com'
-- on conflict do nothing;
