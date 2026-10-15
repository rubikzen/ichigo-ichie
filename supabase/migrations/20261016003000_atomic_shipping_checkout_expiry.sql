-- Keep shipping-order payment expiry and stock/promo restoration in one
-- PostgreSQL transaction. Stripe's signed webhook (or verified return sync)
-- supplies the currently attached Checkout Session ID.
--
-- Intentionally shipping-only: boutique pickup behaviour stays unchanged.
create or replace function public.finalize_shipping_checkout_unpaid(
  p_order_id uuid,
  p_session_id text,
  p_new_payment_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  if p_new_payment_status not in ('expired', 'failed') then
    raise exception 'ICHIGO_INVALID_UNPAID_STATUS';
  end if;

  if p_session_id is null or p_session_id !~ '^cs_(test|live)_[A-Za-z0-9]+
         stripe_checkout_session_id, stock_reserved, promo_reserved
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or v_order.order_type is distinct from 'shipping'
     or v_order.payment_method is distinct from 'online'
     or v_order.stripe_checkout_session_id is distinct from p_session_id
     or v_order.payment_status not in ('pending', 'unpaid', 'failed', 'expired')
     or v_order.status in ('preparing', 'ready', 'completed', 'refunded')
  then
    return false;
  end if;

  -- Out-of-order async failure must never regress expiry, but must heal stock on replay.
  if v_order.payment_status = 'expired' and p_new_payment_status = 'failed' then
    p_new_payment_status := 'expired';
  end if;

  -- Fail rather than silently losing a reservation for a deleted or
  -- mismatched shipping product/variant. The transaction then rolls back.
  if v_order.stock_reserved and exists (
    select 1
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    left join public.product_variants v on v.id = oi.variant_id and v.product_id = oi.product_id
    where oi.order_id = p_order_id
      and (p.id is null or c.kind is distinct from 'shop'
           or (oi.variant_id is not null and v.id is null))
  ) then
    raise exception 'ICHIGO_SHIPPING_STOCK_REFERENCE_MISSING';
  end if;

  -- Lock the order for the whole transition; releases lock the same order
  -- and update stock / promo counters in this SAME transaction.
  if v_order.payment_status <> p_new_payment_status then
    update public.orders
    set payment_status = p_new_payment_status,
        payment_expires_at = null
    where id = p_order_id;
  elsif v_order.stock_reserved or v_order.promo_reserved then
    update public.orders
    set payment_expires_at = null
    where id = p_order_id and payment_expires_at is not null;
  end if;

  perform public.release_shop_order_stock(p_order_id);
  perform public.release_order_promo(p_order_id);

  return true;
end;
$$;

-- Only the service-role backend may finalize a Stripe payment attempt.
revoke all on function public.finalize_shipping_checkout_unpaid(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_shipping_checkout_unpaid(uuid, text, text) to service_role;
 then
    return false;
  end if;

  select id, order_type, payment_method, status, payment_status,
         stripe_checkout_session_id, stock_reserved, promo_reserved
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or v_order.order_type is distinct from 'shipping'
     or v_order.payment_method is distinct from 'online'
     or v_order.stripe_checkout_session_id is distinct from p_session_id
     or v_order.payment_status not in ('pending', 'unpaid', 'failed', 'expired')
     or v_order.status in ('preparing', 'ready', 'completed', 'refunded')
  then
    return false;
  end if;

  -- Out-of-order async failure must never regress a previously expired attempt.
  if v_order.payment_status = 'expired' and p_new_payment_status = 'failed' then
    return false;
  end if;

  -- Lock the order for the whole transition; releases lock the same order
  -- and update stock / promo counters in this SAME transaction.
  if v_order.payment_status <> p_new_payment_status then
    update public.orders
    set payment_status = p_new_payment_status,
        payment_expires_at = null
    where id = p_order_id;
  elsif v_order.stock_reserved or v_order.promo_reserved then
    update public.orders
    set payment_expires_at = null
    where id = p_order_id and payment_expires_at is not null;
  end if;

  perform public.release_shop_order_stock(p_order_id);
  perform public.release_order_promo(p_order_id);

  return true;
end;
$$;

-- Only the service-role backend may finalize a Stripe payment attempt.
revoke all on function public.finalize_shipping_checkout_unpaid(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_shipping_checkout_unpaid(uuid, text, text) to service_role;
