-- Ichigo Ichie V2.34 — promo codes / campaigns

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  campaign_name text not null default '',
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null,
  min_order_amount numeric(10,2) not null default 0 check (min_order_amount >= 0),
  max_discount_amount numeric(10,2),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0 check (used_count >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_discount_value_check check (
    (discount_type = 'percent' and discount_value > 0 and discount_value <= 100)
    or (discount_type = 'fixed' and discount_value > 0)
  ),
  constraint promo_max_discount_check check (max_discount_amount is null or max_discount_amount > 0),
  constraint promo_usage_limit_check check (usage_limit is null or usage_limit > 0),
  constraint promo_dates_check check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create or replace function public.normalize_promo_code_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := upper(regexp_replace(trim(new.code), '\s+', '', 'g'));
  new.campaign_name := coalesce(nullif(trim(new.campaign_name), ''), new.code);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_normalize_promo_code on public.promo_codes;
create trigger trg_normalize_promo_code
before insert or update on public.promo_codes
for each row execute function public.normalize_promo_code_row();

create unique index if not exists idx_promo_codes_code on public.promo_codes(code);
create index if not exists idx_promo_codes_active_dates on public.promo_codes(active, starts_at, ends_at);

alter table public.promo_codes enable row level security;
drop policy if exists promo_codes_admin_all on public.promo_codes;
create policy promo_codes_admin_all
on public.promo_codes
for all
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

alter table public.orders
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column if not exists promo_code text,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists promo_reserved boolean not null default false,
  add column if not exists promo_redeemed_at timestamptz;

alter table public.orders drop constraint if exists orders_discount_amount_check;
alter table public.orders add constraint orders_discount_amount_check check (discount_amount >= 0);
create index if not exists idx_orders_promo_code_id on public.orders(promo_code_id) where promo_code_id is not null;

-- Reserve one promo use while Stripe Checkout is open. This prevents a limited
-- event code from being oversubscribed by simultaneous unpaid orders.
create or replace function public.reserve_order_promo(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_promo public.promo_codes%rowtype;
begin
  select id, promo_code_id, subtotal, discount_amount, promo_reserved, promo_redeemed_at
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.promo_code_id is null or v_order.promo_redeemed_at is not null or v_order.promo_reserved then
    return;
  end if;

  select * into v_promo
  from public.promo_codes
  where id = v_order.promo_code_id
  for update;

  if not found or not v_promo.active then
    raise exception 'ICHIGO_PROMO_INACTIVE';
  end if;
  if v_promo.starts_at is not null and now() < v_promo.starts_at then
    raise exception 'ICHIGO_PROMO_NOT_STARTED';
  end if;
  if v_promo.ends_at is not null and now() > v_promo.ends_at then
    raise exception 'ICHIGO_PROMO_EXPIRED';
  end if;
  if coalesce(v_order.subtotal, 0) < coalesce(v_promo.min_order_amount, 0) then
    raise exception 'ICHIGO_PROMO_MINIMUM';
  end if;
  if coalesce(v_order.discount_amount, 0) <= 0 then
    raise exception 'ICHIGO_PROMO_NO_DISCOUNT';
  end if;
  if v_promo.usage_limit is not null and (v_promo.used_count + v_promo.reserved_count) >= v_promo.usage_limit then
    raise exception 'ICHIGO_PROMO_USAGE_LIMIT';
  end if;

  update public.promo_codes
  set reserved_count = reserved_count + 1, updated_at = now()
  where id = v_promo.id;

  update public.orders
  set promo_reserved = true
  where id = p_order_id;
end;
$$;

create or replace function public.commit_order_promo(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select id, promo_code_id, promo_reserved, promo_redeemed_at
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.promo_code_id is null or v_order.promo_redeemed_at is not null then
    return;
  end if;

  perform 1 from public.promo_codes where id = v_order.promo_code_id for update;

  update public.promo_codes
  set reserved_count = greatest(0, reserved_count - case when v_order.promo_reserved then 1 else 0 end),
      used_count = used_count + 1,
      updated_at = now()
  where id = v_order.promo_code_id;

  update public.orders
  set promo_reserved = false,
      promo_redeemed_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.release_order_promo(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select id, promo_code_id, promo_reserved, promo_redeemed_at
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found or v_order.promo_code_id is null or not v_order.promo_reserved or v_order.promo_redeemed_at is not null then
    return;
  end if;

  perform 1 from public.promo_codes where id = v_order.promo_code_id for update;
  update public.promo_codes
  set reserved_count = greatest(0, reserved_count - 1), updated_at = now()
  where id = v_order.promo_code_id;

  update public.orders set promo_reserved = false where id = p_order_id;
end;
$$;

-- Clean up a reserved code if a pending order is deleted before payment.
create or replace function public.release_promo_before_order_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.promo_code_id is not null and old.promo_reserved and old.promo_redeemed_at is null then
    update public.promo_codes
    set reserved_count = greatest(0, reserved_count - 1), updated_at = now()
    where id = old.promo_code_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_release_promo_before_order_delete on public.orders;
create trigger trg_release_promo_before_order_delete
before delete on public.orders
for each row execute function public.release_promo_before_order_delete();

insert into public.site_settings(key, value)
values ('promo_field_visible', to_jsonb('true'::text))
on conflict (key) do nothing;

comment on table public.promo_codes is 'Merchant-managed promotion codes. Public validation is performed server-side only.';
comment on column public.orders.discount_amount is 'Discount applied to product subtotal before shipping.';

grant select, insert, update, delete on public.promo_codes to authenticated;
revoke all on function public.reserve_order_promo(uuid) from public, anon, authenticated;
revoke all on function public.commit_order_promo(uuid) from public, anon, authenticated;
revoke all on function public.release_order_promo(uuid) from public, anon, authenticated;
grant execute on function public.reserve_order_promo(uuid) to service_role;
grant execute on function public.commit_order_promo(uuid) to service_role;
grant execute on function public.release_order_promo(uuid) to service_role;
