-- Ichigo Ichie V2.28 — Contact form inbox

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','read','archived')),
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  message text not null,
  locale text not null default 'fr' check (locale in ('fr','en'))
);

create index if not exists idx_contact_messages_created_at on public.contact_messages(created_at desc);
create index if not exists idx_contact_messages_status on public.contact_messages(status, created_at desc);

alter table public.contact_messages enable row level security;

create or replace function public.is_ichigo_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_ichigo_admin() from public;
grant execute on function public.is_ichigo_admin() to authenticated;

drop policy if exists contact_messages_admin_select on public.contact_messages;
create policy contact_messages_admin_select on public.contact_messages
for select to authenticated
using (public.is_ichigo_admin());

drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update on public.contact_messages
for update to authenticated
using (public.is_ichigo_admin())
with check (public.is_ichigo_admin());

drop policy if exists contact_messages_admin_delete on public.contact_messages;
create policy contact_messages_admin_delete on public.contact_messages
for delete to authenticated
using (public.is_ichigo_admin());

comment on table public.contact_messages is 'Messages submitted from the public Ichigo Ichie contact form';
