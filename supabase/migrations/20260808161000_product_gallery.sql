-- Ichigo Ichie V2.5: shared product gallery (3 photos per product)

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product on public.product_images(product_id, sort_order);

grant select on public.product_images to anon, authenticated;
grant select, insert, update, delete on public.product_images to authenticated;

alter table public.product_images enable row level security;

drop policy if exists "public read product images gallery" on public.product_images;
create policy "public read product images gallery"
on public.product_images for select to anon, authenticated
using (true);

drop policy if exists "admin insert product images gallery" on public.product_images;
create policy "admin insert product images gallery"
on public.product_images for insert to authenticated
with check (public.is_admin());

drop policy if exists "admin update product images gallery" on public.product_images;
create policy "admin update product images gallery"
on public.product_images for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete product images gallery" on public.product_images;
create policy "admin delete product images gallery"
on public.product_images for delete to authenticated
using (public.is_admin());

-- Preserve every product's current image as photo 1.
insert into public.product_images (product_id, url, sort_order)
select p.id, p.image_url, 0
from public.products p
where p.image_url is not null
  and length(trim(p.image_url)) > 0
  and not exists (
    select 1 from public.product_images pi where pi.product_id = p.id
  );
