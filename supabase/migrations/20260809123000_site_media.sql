-- Ichigo Ichie V2.22 — Media Manager for UI assets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read site media" on storage.objects;
create policy "public read site media"
on storage.objects for select
to public
using (bucket_id = 'site-media');

drop policy if exists "admins insert site media" on storage.objects;
create policy "admins insert site media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "admins update site media" on storage.objects;
create policy "admins update site media"
on storage.objects for update
to authenticated
using (bucket_id = 'site-media' and public.is_admin())
with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists "admins delete site media" on storage.objects;
create policy "admins delete site media"
on storage.objects for delete
to authenticated
using (bucket_id = 'site-media' and public.is_admin());
