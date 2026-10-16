-- Optimize Supabase RLS auth.uid() call frequency; retain policy roles and predicates.
alter policy "admins can read own admin row" on public.admins
  using (user_id = (select auth.uid()));

alter policy "pickup staff read own row" on public.pickup_staff
  using (user_id = (select auth.uid()));

alter policy "promo_codes_admin_all" on public.promo_codes
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
