-- Ichigo Ichie V444 — Secure pickup staff identity
-- Pickup staff is deliberately separate from public.admins.
-- Existing admin RLS and admin API authorization remain unchanged.

create table if not exists public.pickup_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select on public.pickup_staff to authenticated;

alter table public.pickup_staff enable row level security;

drop policy if exists "pickup staff read own row" on public.pickup_staff;
create policy "pickup staff read own row"
on public.pickup_staff
for select
to authenticated
using (user_id = auth.uid());

-- IMPORTANT:
-- 1. Create the employee in Supabase Authentication > Users.
-- 2. Then grant scanner-only access with:
--
-- insert into public.pickup_staff(user_id)
-- select id from auth.users where email = 'EMPLOYEE@example.com'
-- on conflict (user_id) do nothing;
--
-- Do NOT insert scanner-only employees into public.admins.
