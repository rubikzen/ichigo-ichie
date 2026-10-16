-- Ichigo Ichie: covering indexes for seven verified unindexed foreign keys.
-- Supabase Performance Advisor finding: unindexed_foreign_keys (2026-10-16).
-- Additive and idempotent: no inventory, payment, customer or RLS changes.
--
-- These indexes speed up parent-key deletes/updates, JOINs and lookups.
-- This migration should be applied to the Ichigo Ichie project only.

create index if not exists idx_invoices_original_invoice_id
  on public.invoices (original_invoice_id);

create index if not exists idx_order_items_order_id
  on public.order_items (order_id);

create index if not exists idx_order_items_product_id
  on public.order_items (product_id);

create index if not exists idx_order_items_variant_id
  on public.order_items (variant_id);

create index if not exists idx_product_option_groups_option_group_id
  on public.product_option_groups (option_group_id);

create index if not exists idx_product_reviews_order_item_id
  on public.product_reviews (order_item_id);

create index if not exists idx_restock_subscriptions_variant_id
  on public.restock_subscriptions (variant_id);
