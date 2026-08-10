-- Ichigo Ichie V2.27 — production cleanup, tracking, refund state and transactional email markers

alter table public.orders
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists shipping_email_sent_at timestamptz,
  add column if not exists refund_email_sent_at timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid','pending','paid','refunded','refund_pending','refund_failed','failed','expired'));

create index if not exists idx_orders_tracking_number on public.orders(tracking_number) where tracking_number is not null;
create unique index if not exists idx_orders_stripe_refund on public.orders(stripe_refund_id) where stripe_refund_id is not null;

-- Never silently cancel an online order that is already paid. A paid Stripe
-- order must go through the refund API so the database cannot claim a refund
-- that never happened.
create or replace function public.guard_paid_order_cancellation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.payment_method = 'online'
     and old.payment_status in ('paid','refund_pending','refund_failed')
     and new.status = 'cancelled'
     and new.payment_status <> 'refunded' then
    raise exception 'ICHIGO_PAID_ORDER_REQUIRES_REFUND';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_paid_order_cancellation on public.orders;
create trigger trg_guard_paid_order_cancellation
before update of status, payment_status on public.orders
for each row
execute function public.guard_paid_order_cancellation();

-- Replace the older stock-status trigger with payment-aware behaviour.
create or replace function public.sync_order_stock_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if old.status not in ('cancelled','refunded') and new.status = 'refunded' then
      perform public.release_shop_order_stock(new.id);
    elsif old.status not in ('cancelled','refunded') and new.status = 'cancelled' and new.payment_status not in ('paid','refund_pending','refund_failed') then
      perform public.release_shop_order_stock(new.id);
    elsif old.status in ('cancelled','refunded') and new.status not in ('cancelled','refunded')
      and new.payment_status not in ('refunded','refund_pending','refund_failed') then
      perform public.reserve_shop_order_stock(new.id);
    end if;
  end if;
  return new;
end;
$$;

comment on column public.orders.tracking_number is 'Carrier parcel tracking number entered by admin';
comment on column public.orders.tracking_url is 'Public carrier tracking URL';
comment on column public.orders.stripe_refund_id is 'Stripe Refund id re_... for online refunds';

-- Remove CMS keys that are no longer used after the one-page / information-only menu redesign.
delete from public.site_settings where key in (
  'home_point1_fr','home_point1_en','home_point2_fr','home_point2_en','home_point3_fr','home_point3_en',
  'home_trust_visible',
  'trust1_title_fr','trust1_title_en','trust1_text_fr','trust1_text_en',
  'trust2_title_fr','trust2_title_en','trust2_text_fr','trust2_text_en',
  'trust3_title_fr','trust3_title_en','trust3_text_fr','trust3_text_en',
  'menu_search_fr','menu_search_en','shop_search_fr','shop_search_en','option_presets'
);

-- Migrate only legacy default wording that became misleading after the Menu
-- changed to an information-only catalogue. Custom merchant text is preserved.
update public.site_settings set value = to_jsonb('Boutique en ligne · Retrait à Nice'::text)
  where key = 'announcement_fr' and value = to_jsonb('Retrait boutique à Nice · Commande en ligne'::text);
update public.site_settings set value = to_jsonb('Online shop · Pickup in Nice'::text)
  where key = 'announcement_en' and value = to_jsonb('Boutique pickup in Nice · Order online'::text);
update public.site_settings set value = to_jsonb('La carte'::text)
  where key = 'nav_menu_fr' and value = to_jsonb('Menu'::text);
update public.site_settings set value = to_jsonb('Voir la carte'::text)
  where key in ('home_primary_cta_fr','story_link_fr') and value = to_jsonb('Voir le menu'::text);
update public.site_settings set value = to_jsonb('View the menu'::text)
  where key in ('home_primary_cta_en','story_link_en')
    and value in (to_jsonb('View menu'::text), to_jsonb('View the menu'::text));
update public.site_settings set value = to_jsonb('Découvrir la boutique'::text)
  where key = 'home_secondary_cta_fr' and value = to_jsonb('Acheter du matcha'::text);
update public.site_settings set value = to_jsonb('Discover the shop'::text)
  where key = 'home_secondary_cta_en' and value = to_jsonb('Shop matcha'::text);
update public.site_settings set value = to_jsonb('Boissons et desserts à découvrir directement dans notre maison du Vieux Nice.'::text)
  where key = 'menu_intro_fr' and value = to_jsonb('Boissons et desserts préparés à la commande dans notre boutique du Vieux Nice.'::text);
update public.site_settings set value = to_jsonb('Drinks and desserts to discover in our Vieux Nice matcha house.'::text)
  where key = 'menu_intro_en' and value = to_jsonb('Drinks and desserts prepared to order in our Vieux Nice boutique.'::text);
update public.site_settings set value = to_jsonb('Ajoutez un matcha, un accessoire ou un coffret depuis la Boutique.'::text)
  where key = 'cart_empty_text_fr' and value = to_jsonb('Ajoutez une boisson, un dessert ou un produit de la boutique.'::text);
update public.site_settings set value = to_jsonb('Add matcha, accessories or a gift set from the Shop.'::text)
  where key = 'cart_empty_text_en' and value = to_jsonb('Add a drink, dessert or shop product.'::text);
update public.site_settings set value = to_jsonb('Maison japonaise de matcha à Nice : carte sur place, matcha japonais et accessoires disponibles dans notre boutique en ligne.'::text)
  where key = 'seo_description' and value = to_jsonb('Matcha japonais, boissons et douceurs à Nice. Menu et commande en ligne.'::text);
