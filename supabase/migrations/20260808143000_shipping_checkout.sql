-- Ichigo Ichie V2.2 — Boutique shipping, package weights and France delivery rates

alter table public.products
  add column if not exists shipping_weight_g integer not null default 0 check (shipping_weight_g >= 0);

alter table public.product_variants
  add column if not exists shipping_weight_g integer not null default 0 check (shipping_weight_g >= 0);

alter table public.orders
  add column if not exists shipping_method_id text,
  add column if not exists shipping_method_name text,
  add column if not exists shipping_address1 text,
  add column if not exists shipping_address2 text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_city text,
  add column if not exists shipping_country text,
  add column if not exists package_weight_g integer not null default 0 check (package_weight_g >= 0);

create table if not exists public.shipping_methods (
  id text primary key,
  name_fr text not null,
  name_en text not null,
  description_fr text not null default '',
  description_en text not null default '',
  active boolean not null default true,
  countries text[] not null default array['FR']::text[],
  free_threshold numeric(10,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_rate_bands (
  id uuid primary key default gen_random_uuid(),
  method_id text not null references public.shipping_methods(id) on delete cascade,
  max_weight_g integer not null check (max_weight_g > 0),
  price numeric(10,2) not null check (price >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(method_id, max_weight_g)
);

create index if not exists idx_shipping_rates_method_weight
  on public.shipping_rate_bands(method_id, max_weight_g);

-- Keep updated_at consistent with the rest of the admin-managed tables.
drop trigger if exists trg_shipping_methods_updated_at on public.shipping_methods;
create trigger trg_shipping_methods_updated_at
before update on public.shipping_methods
for each row execute function public.set_updated_at();

drop trigger if exists trg_shipping_rate_bands_updated_at on public.shipping_rate_bands;
create trigger trg_shipping_rate_bands_updated_at
before update on public.shipping_rate_bands
for each row execute function public.set_updated_at();

-- Readable publicly for checkout quotes; writable only by authenticated admins via RLS.
grant select on public.shipping_methods, public.shipping_rate_bands to anon, authenticated;
grant insert, update, delete on public.shipping_methods, public.shipping_rate_bands to authenticated;

alter table public.shipping_methods enable row level security;
alter table public.shipping_rate_bands enable row level security;

drop policy if exists "public read active shipping methods" on public.shipping_methods;
create policy "public read active shipping methods"
on public.shipping_methods for select to anon, authenticated
using (active or public.is_admin());

drop policy if exists "public read shipping rates" on public.shipping_rate_bands;
create policy "public read shipping rates"
on public.shipping_rate_bands for select to anon, authenticated
using (exists (
  select 1 from public.shipping_methods m
  where m.id = method_id and (m.active or public.is_admin())
));

drop policy if exists "admin insert shipping methods" on public.shipping_methods;
create policy "admin insert shipping methods"
on public.shipping_methods for insert to authenticated
with check (public.is_admin());

drop policy if exists "admin update shipping methods" on public.shipping_methods;
create policy "admin update shipping methods"
on public.shipping_methods for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete shipping methods" on public.shipping_methods;
create policy "admin delete shipping methods"
on public.shipping_methods for delete to authenticated
using (public.is_admin());

drop policy if exists "admin insert shipping rates" on public.shipping_rate_bands;
create policy "admin insert shipping rates"
on public.shipping_rate_bands for insert to authenticated
with check (public.is_admin());

drop policy if exists "admin update shipping rates" on public.shipping_rate_bands;
create policy "admin update shipping rates"
on public.shipping_rate_bands for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete shipping rates" on public.shipping_rate_bands;
create policy "admin delete shipping rates"
on public.shipping_rate_bands for delete to authenticated
using (public.is_admin());

-- Packaging weight is added once per shipment, on top of the gross weight of each item.
insert into public.site_settings(key,value) values
  ('shipping_packaging_weight_g', to_jsonb('120'::text))
on conflict (key) do nothing;

-- Starter weights for the existing Boutique products. Admin can change them any time.
update public.products set shipping_weight_g = 90
where id = '20000000-0000-0000-0000-000000000006' and shipping_weight_g = 0;
update public.products set shipping_weight_g = 80
where id = '20000000-0000-0000-0000-000000000007' and shipping_weight_g = 0;

update public.product_variants set shipping_weight_g = 90
where id = '30000000-0000-0000-0000-000000000001' and shipping_weight_g = 0;
update public.product_variants set shipping_weight_g = 75
where id = '30000000-0000-0000-0000-000000000002' and shipping_weight_g = 0;
update public.product_variants set shipping_weight_g = 125
where id = '30000000-0000-0000-0000-000000000003' and shipping_weight_g = 0;

-- Default France Métropolitaine home-delivery method.
-- Prices are editable in Admin > Livraison; these starter values follow the 2026
-- public Colissimo online tariff grid used when this migration was prepared.
insert into public.shipping_methods(
  id,name_fr,name_en,description_fr,description_en,active,countries,free_threshold,sort_order
) values (
  'colissimo-home',
  'Colissimo à domicile',
  'Colissimo home delivery',
  'Livraison suivie à domicile en France métropolitaine.',
  'Tracked home delivery in metropolitan France.',
  true,
  array['FR']::text[],
  89.00,
  1
)
on conflict (id) do update set
  name_fr = excluded.name_fr,
  name_en = excluded.name_en,
  description_fr = excluded.description_fr,
  description_en = excluded.description_en;

insert into public.shipping_rate_bands(method_id,max_weight_g,price,sort_order) values
  ('colissimo-home',250,5.49,1),
  ('colissimo-home',500,7.59,2),
  ('colissimo-home',750,9.29,3),
  ('colissimo-home',1000,9.59,4),
  ('colissimo-home',2000,11.19,5),
  ('colissimo-home',5000,17.39,6),
  ('colissimo-home',10000,25.29,7),
  ('colissimo-home',15000,31.99,8),
  ('colissimo-home',20000,39.59,9),
  ('colissimo-home',30000,39.59,10)
on conflict (method_id,max_weight_g) do nothing;
