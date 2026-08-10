-- Ichigo Ichie V2.1 - order flow hardening and public tracking
alter table public.orders add column if not exists public_token uuid;
alter table public.orders add column if not exists client_reference uuid;

update public.orders set public_token = gen_random_uuid() where public_token is null;
alter table public.orders alter column public_token set default gen_random_uuid();
alter table public.orders alter column public_token set not null;

create unique index if not exists idx_orders_public_token on public.orders(public_token);
create unique index if not exists idx_orders_client_reference on public.orders(client_reference) where client_reference is not null;
