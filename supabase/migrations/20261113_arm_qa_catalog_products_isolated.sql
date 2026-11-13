-- Migration applied via Supabase MCP on 2026-11-13.
-- QA-only ALEX fixtures are isolated from the arm_products operational catalog.
CREATE TABLE IF NOT EXISTS public.arm_qa_catalog_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  partnumber text not null,
  title text not null,
  brand text not null,
  category_path text[] not null,
  family_key text,
  variant_options jsonb not null default '{}'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  demo_price_pen numeric(12,2) not null,
  demo_stock_units integer not null,
  demo_stock_status text not null default 'disponible',
  is_test_data boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arm_qa_catalog_products_workspace_sku_key unique (workspace_id,partnumber),
  constraint arm_qa_catalog_products_sku_valid check (partnumber ~ '^QA-[A-Z0-9][A-Z0-9._-]{2,76}$'),
  constraint arm_qa_catalog_products_title_valid check (char_length(title) between 6 and 180),
  constraint arm_qa_catalog_products_category_valid check (cardinality(category_path) between 2 and 4),
  constraint arm_qa_catalog_products_demo_price_valid check (demo_price_pen >= 0),
  constraint arm_qa_catalog_products_demo_units_valid check (demo_stock_units between 0 and 999),
  constraint arm_qa_catalog_products_demo_status_valid check (demo_stock_status in ('disponible','no disponible','por confirmar')),
  constraint arm_qa_catalog_products_only_test check (is_test_data is true)
);
ALTER TABLE public.arm_qa_catalog_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.arm_qa_catalog_products FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.arm_qa_catalog_products TO service_role;
COMMENT ON TABLE public.arm_qa_catalog_products IS 'Private ALEX lab fixtures. No live search RPC, chat, marketplace, quotes or orders must use this table.';
CREATE INDEX IF NOT EXISTS arm_qa_catalog_products_category_idx
  ON public.arm_qa_catalog_products USING gin(category_path);
