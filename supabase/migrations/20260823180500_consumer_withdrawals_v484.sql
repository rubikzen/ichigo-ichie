-- V484 - Online consumer withdrawal / retractation
-- Stores the consumer declaration as received. It does NOT cancel, refund,
-- restore stock or decide legal eligibility automatically.

create table if not exists public.consumer_withdrawals (
  id uuid primary key default gen_random_uuid(),
  client_reference uuid not null unique,
  request_number text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_number text not null,
  customer_first_name text not null default '',
  customer_last_name text not null default '',
  customer_email text not null,
  acknowledgement_email text not null,
  scope text not null check (scope in ('full','partial')),
  selected_items jsonb not null default '[]'::jsonb,
  declaration_text text not null,
  customer_note text not null default '',
  locale text not null default 'fr' check (locale in ('fr','en')),
  status text not null default 'received'
    check (status in ('received','reviewed','processed','rejected')),
  submitted_at timestamptz not null default now(),
  acknowledgement_sent_at timestamptz,
  acknowledgement_error text,
  merchant_notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_consumer_withdrawals_submitted
  on public.consumer_withdrawals(submitted_at desc);
create index if not exists idx_consumer_withdrawals_status
  on public.consumer_withdrawals(status, submitted_at desc);
create index if not exists idx_consumer_withdrawals_order
  on public.consumer_withdrawals(order_id, submitted_at desc);

alter table public.consumer_withdrawals enable row level security;

drop policy if exists consumer_withdrawals_admin_select on public.consumer_withdrawals;
create policy consumer_withdrawals_admin_select
on public.consumer_withdrawals
for select to authenticated
using (public.is_ichigo_admin());

drop policy if exists consumer_withdrawals_admin_update on public.consumer_withdrawals;
create policy consumer_withdrawals_admin_update
on public.consumer_withdrawals
for update to authenticated
using (public.is_ichigo_admin())
with check (public.is_ichigo_admin());

revoke all on table public.consumer_withdrawals from anon;
grant select, update on table public.consumer_withdrawals to authenticated;

comment on table public.consumer_withdrawals is
  'Consumer withdrawal declarations received online. Receipt does not itself decide eligibility or trigger refund/cancellation.';

-- site_settings.value is jsonb.
-- Extract the scalar JSON string as text, replace the exact placeholder,
-- then encode it back to jsonb.
update public.site_settings
set value = to_jsonb(
  replace(
    coalesce(value #>> '{}', ''),
    '[À COMPLÉTER AVEC L’URL OU L’EMPLACEMENT EXACT AVANT MISE EN LIGNE]',
    'La fonctionnalité de rétractation est accessible directement à l’adresse : https://www.ichigoichiematcha.fr/retractation'
  )
)
where key = 'terms_body_fr'
  and strpos(
    coalesce(value #>> '{}', ''),
    '[À COMPLÉTER AVEC L’URL OU L’EMPLACEMENT EXACT AVANT MISE EN LIGNE]'
  ) > 0;
