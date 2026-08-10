-- Ichigo Ichie V2.46 — Production readiness
-- Separates TEST/LIVE commerce data and adds reversible test-data archiving.

alter table public.orders
  add column if not exists environment text not null default 'legacy',
  add column if not exists archived_at timestamptz;

alter table public.invoices
  add column if not exists environment text not null default 'legacy';

alter table public.invoice_counters
  add column if not exists environment text not null default 'legacy';

alter table public.invoice_counters drop constraint if exists invoice_counters_pkey;
alter table public.invoice_counters
  add constraint invoice_counters_pkey primary key (document_type, year, environment);

-- The existing counter was created while the shop was still being tested. Seed
-- the TEST sequence from it so renamed historical test documents can never
-- collide with future TEST-FAC / TEST-AV numbers. LIVE starts its own sequence.
insert into public.invoice_counters(document_type, year, environment, last_number)
select document_type, year, 'test', last_number
from public.invoice_counters
where environment = 'legacy'
on conflict (document_type, year, environment)
do update set last_number = greatest(invoice_counters.last_number, excluded.last_number);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invoice_counters_environment_check') then
    alter table public.invoice_counters add constraint invoice_counters_environment_check check (environment in ('test','live','legacy'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_environment_check') then
    alter table public.orders add constraint orders_environment_check check (environment in ('test','live','legacy'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_environment_check') then
    alter table public.invoices add constraint invoices_environment_check check (environment in ('test','live','legacy'));
  end if;
end $$;

create index if not exists idx_orders_environment_created on public.orders(environment, created_at desc);
create index if not exists idx_orders_active_environment on public.orders(environment, created_at desc) where archived_at is null;
create index if not exists idx_invoices_environment_issued on public.invoices(environment, issued_at desc);

-- Existing data remains LEGACY on purpose. The admin explicitly decides whether
-- it is test data before V2.46 archives anything.
update public.invoices i
set environment = o.environment
from public.orders o
where i.order_id = o.id
  and i.environment = 'legacy'
  and o.environment <> 'legacy';

-- Keep invoice issuance atomic while copying the order environment into the
-- immutable invoice snapshot. Function signature stays unchanged.
create or replace function public.issue_invoice_document(
  p_order_id uuid,
  p_document_type text,
  p_original_invoice_id uuid,
  p_seller jsonb,
  p_customer jsonb,
  p_lines jsonb,
  p_tax_summary jsonb,
  p_subtotal_ttc numeric,
  p_discount_ttc numeric,
  p_shipping_ttc numeric,
  p_total_ht numeric,
  p_total_tax numeric,
  p_total_ttc numeric,
  p_prefix text
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.invoices%rowtype;
  v_counter integer;
  v_year integer := extract(year from current_date)::integer;
  v_number text;
  v_order_customer uuid;
  v_environment text;
  v_result public.invoices%rowtype;
begin
  if p_document_type not in ('invoice','credit_note') then
    raise exception 'ICHIGO_INVOICE_TYPE';
  end if;

  perform pg_advisory_xact_lock(hashtext('ichigo-invoice-' || p_order_id::text || '-' || p_document_type));

  select * into v_existing
  from public.invoices
  where order_id = p_order_id and document_type = p_document_type
  limit 1;
  if found then return v_existing; end if;

  select customer_id, environment into v_order_customer, v_environment
  from public.orders
  where id = p_order_id;
  if not found then raise exception 'ICHIGO_INVOICE_ORDER_NOT_FOUND'; end if;

  insert into public.invoice_counters(document_type, year, environment, last_number)
  values (p_document_type, v_year, coalesce(v_environment, 'legacy'), 1)
  on conflict (document_type, year, environment)
  do update set last_number = invoice_counters.last_number + 1
  returning last_number into v_counter;

  v_number := (case when v_environment = 'test' then 'TEST-' else '' end)
    || upper(coalesce(nullif(trim(p_prefix), ''), case when p_document_type='invoice' then 'FAC' else 'AV' end))
    || '-' || v_year::text || '-' || lpad(v_counter::text, 6, '0');

  insert into public.invoices(
    order_id, customer_id, document_type, original_invoice_id, document_number,
    seller_snapshot, customer_snapshot, lines, tax_summary,
    subtotal_ttc, discount_ttc, shipping_ttc, total_ht, total_tax, total_ttc,
    environment
  ) values (
    p_order_id, v_order_customer, p_document_type, p_original_invoice_id, v_number,
    p_seller, p_customer, p_lines, coalesce(p_tax_summary, '[]'::jsonb),
    p_subtotal_ttc, p_discount_ttc, p_shipping_ttc, p_total_ht, p_total_tax, p_total_ttc,
    coalesce(v_environment, 'legacy')
  ) returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.issue_invoice_document(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.issue_invoice_document(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,text) to service_role;
