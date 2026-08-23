-- V483 — Commercial launch gate
-- Structured food information for prepacked online food products.
-- Existing products intentionally remain {} until the merchant verifies the label.

alter table public.products
  add column if not exists food_info jsonb not null default '{}'::jsonb;

comment on column public.products.food_info is
  'Merchant-verified food information shown before online purchase: legal name, ingredients, allergens, net quantity, storage, responsible operator and optional preparation guidance.';
