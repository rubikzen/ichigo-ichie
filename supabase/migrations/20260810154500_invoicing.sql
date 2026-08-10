-- Ichigo Ichie V2.45 — Facturation
-- Immutable invoice/credit-note snapshots with continuous yearly numbering.

create extension if not exists pgcrypto;

alter table public.products
  add column if not exists vat_rate numeric(5,2);

alter table public.order_items
  add column if not exists vat_rate numeric(5,2);

create table if not exists public.invoice_counters (
  document_type text not null check (document_type in ('invoice','credit_note')),
  year integer not null,
  last_number integer not null default 0,
  primary key (document_type, year)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid references auth.users(id) on delete set null,
  document_type text not null check (document_type in ('invoice','credit_note')),
  original_invoice_id uuid references public.invoices(id) on delete restrict,
  document_number text not null unique,
  issued_at timestamptz not null default now(),
  currency text not null default 'EUR',
  seller_snapshot jsonb not null,
  customer_snapshot jsonb not null,
  lines jsonb not null,
  tax_summary jsonb not null default '[]'::jsonb,
  subtotal_ttc numeric(12,2) not null default 0,
  discount_ttc numeric(12,2) not null default 0,
  shipping_ttc numeric(12,2) not null default 0,
  total_ht numeric(12,2) not null default 0,
  total_tax numeric(12,2) not null default 0,
  total_ttc numeric(12,2) not null default 0,
  status text not null default 'issued' check (status in ('issued')),
  email_sent_at timestamptz,
  pdf_generated_at timestamptz,
  structured_version text not null default 'ichigo-invoice-v1',
  created_at timestamptz not null default now(),
  unique(order_id, document_type)
);

create index if not exists idx_invoices_order on public.invoices(order_id, document_type);
create index if not exists idx_invoices_customer on public.invoices(customer_id, issued_at desc);
create index if not exists idx_invoices_issued on public.invoices(issued_at desc);

alter table public.invoices enable row level security;
grant select on public.invoices to authenticated;

drop policy if exists "admins read invoices" on public.invoices;
create policy "admins read invoices" on public.invoices
  for select to authenticated using (public.is_admin());

drop policy if exists "customers read own invoices" on public.invoices;
create policy "customers read own invoices" on public.invoices
  for select to authenticated
  using ((select auth.uid()) is not null and customer_id = (select auth.uid()));

-- Entire document issuance happens in one transaction. If insertion fails, the
-- counter increment rolls back too, avoiding numbering gaps caused by retries.
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

  select customer_id into v_order_customer from public.orders where id = p_order_id;
  if not found then raise exception 'ICHIGO_INVOICE_ORDER_NOT_FOUND'; end if;

  insert into public.invoice_counters(document_type, year, last_number)
  values (p_document_type, v_year, 1)
  on conflict (document_type, year)
  do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into v_counter;

  v_number := upper(coalesce(nullif(trim(p_prefix), ''), case when p_document_type='invoice' then 'FAC' else 'AV' end))
    || '-' || v_year::text || '-' || lpad(v_counter::text, 6, '0');

  insert into public.invoices(
    order_id, customer_id, document_type, original_invoice_id, document_number,
    seller_snapshot, customer_snapshot, lines, tax_summary,
    subtotal_ttc, discount_ttc, shipping_ttc, total_ht, total_tax, total_ttc
  ) values (
    p_order_id, v_order_customer, p_document_type, p_original_invoice_id, v_number,
    p_seller, p_customer, p_lines, coalesce(p_tax_summary, '[]'::jsonb),
    p_subtotal_ttc, p_discount_ttc, p_shipping_ttc, p_total_ht, p_total_tax, p_total_ttc
  ) returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.issue_invoice_document(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,text) from public, anon, authenticated;
grant execute on function public.issue_invoice_document(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,numeric,numeric,numeric,numeric,numeric,numeric,text) to service_role;

insert into public.site_settings(key,value) values
  ('invoice_enabled', 'false'::jsonb),
  ('invoice_auto_email', 'true'::jsonb),
  ('invoice_prefix', to_jsonb('FAC'::text)),
  ('credit_note_prefix', to_jsonb('AV'::text)),
  ('invoice_shipping_vat_rate', to_jsonb('20'::text)),
  ('invoice_legal_name', to_jsonb(''::text)),
  ('invoice_trade_name', to_jsonb('ICHIGO ICHIE'::text)),
  ('invoice_address1', to_jsonb(''::text)),
  ('invoice_address2', to_jsonb(''::text)),
  ('invoice_postal_code', to_jsonb(''::text)),
  ('invoice_city', to_jsonb(''::text)),
  ('invoice_country', to_jsonb('France'::text)),
  ('invoice_siren', to_jsonb(''::text)),
  ('invoice_siret', to_jsonb(''::text)),
  ('invoice_vat_number', to_jsonb(''::text)),
  ('invoice_rcs', to_jsonb(''::text)),
  ('invoice_capital', to_jsonb(''::text)),
  ('invoice_email', to_jsonb(''::text)),
  ('invoice_phone', to_jsonb(''::text)),
  ('invoice_footer', to_jsonb('Merci pour votre confiance.'::text))
on conflict (key) do nothing;
