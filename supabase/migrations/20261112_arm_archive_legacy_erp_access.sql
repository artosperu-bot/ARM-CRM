-- Legacy ERP observations stay archived inside Supabase for a possible future
-- authorized integration, but cannot be consumed by the ARM-CRM browser.
-- No rows or tables are deleted. All active sales data comes from Supabase CRM.
revoke all on public.arm_erp_product_map,public.arm_erp_stock_observations
 from public,anon,authenticated;
comment on table public.arm_erp_product_map is
 'ARCHIVED: not part of active ARM-CRM. Do not use for current sales, stock or product identity.';
comment on table public.arm_erp_stock_observations is
 'ARCHIVED: ERP observations have no current commercial authority. ARM-CRM uses Supabase-only stock.';
