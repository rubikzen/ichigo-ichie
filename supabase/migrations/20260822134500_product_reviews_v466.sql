-- V466 — verified product reviews.
-- Review submission is verified server-side against a completed paid order.
-- No email, phone, address or raw public order token is stored in this table.

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  title text null check (title is null or char_length(title) <= 120),
  body text not null check (char_length(body) between 2 and 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'hidden')),
  admin_reply text null check (
    admin_reply is null or char_length(admin_reply) <= 2000
  ),
  admin_replied_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_reviews_order_product_uidx
  on public.product_reviews(order_id, product_id);

create index if not exists product_reviews_product_status_created_idx
  on public.product_reviews(product_id, status, created_at desc);

create index if not exists product_reviews_status_created_idx
  on public.product_reviews(status, created_at desc);

alter table public.product_reviews enable row level security;

-- Server/service-role only. Public reads and verified submissions go through
-- server routes; admin moderation goes through requireAdmin.
revoke all on table public.product_reviews from anon, authenticated;
grant select, insert, update, delete on table public.product_reviews to service_role;
