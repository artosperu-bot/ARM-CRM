-- Stage ERP evidence separately from catalog used by ALEX, never publish raw stock.
-- Workspace isolation is enforced by RLS and a compound FK to arm_products.
create table if not exists public.arm_erp_product_map(
 workspace_id uuid not null,
 arm_partnumber text not null,
 erp_partnumber text not null,
 origin_server text not null default 'PC005',
 mapping_status text not null check(mapping_status in ('verified_exact','candidate','rejected')),
 evidence text not null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(workspace_id,arm_partnumber),
 foreign key(workspace_id,arm_partnumber) references public.arm_products(workspace_id,partnumber) on delete cascade
);
create table if not exists public.arm_erp_stock_observations(
 workspace_id uuid not null,
 arm_partnumber text not null,
 erp_partnumber text not null,
 source_server text not null check(source_server='PC005'),
 source_table text not null check(source_table='DB_ST.dbo.ST_STOCK_HST_CONSULTA'),
 physical_units integer,
 source_updated_at timestamptz not null,
 observed_at timestamptz not null default now(),
 freshness text not null check(freshness in ('fresh','stale','anomaly','pending_mapping')),
 physical_stock_not_available_stock boolean not null default true check(physical_stock_not_available_stock),
 primary key(workspace_id,arm_partnumber),
 foreign key(workspace_id,arm_partnumber) references public.arm_erp_product_map(workspace_id,arm_partnumber) on delete cascade
);
create index if not exists arm_erp_obs_recent_idx on public.arm_erp_stock_observations(workspace_id,source_updated_at desc);
alter table public.arm_erp_product_map enable row level security;
alter table public.arm_erp_stock_observations enable row level security;
revoke all privileges on public.arm_erp_product_map,public.arm_erp_stock_observations from anon,authenticated;
grant select on public.arm_erp_product_map,public.arm_erp_stock_observations to authenticated;
create policy arm_erp_product_map_read on public.arm_erp_product_map
 for select to authenticated using (exists(select 1 from public.arm_workspaces w where w.id=arm_erp_product_map.workspace_id));
create policy arm_erp_stock_observations_read on public.arm_erp_stock_observations
 for select to authenticated using (exists(select 1 from public.arm_workspaces w where w.id=arm_erp_stock_observations.workspace_id));
comment on table public.arm_erp_stock_observations is
 'Physical ERP inventory for internal audit only. Never use as available-to-promise stock. No API customer replies.';
-- Exact mapping candidates for four pilot products; the name difference requires human review.
insert into public.arm_erp_product_map
 (workspace_id,arm_partnumber,erp_partnumber,mapping_status,evidence,reviewed_at)
select workspace_id,partnumber,
 case when partnumber='ARMOR-22-256G' then 'ARMOR-22-256GB' else partnumber end,
 case when partnumber='ARMOR-22-256G' then 'candidate' else 'verified_exact' end,
 case when partnumber='ARMOR-22-256G' then 'Similar title/specification and unique ERP PN; explicit review still required; no matching existing equivalence row'
 else 'Exact partnumber uniquely found on PC005 linked read-only ERP snapshot' end,
 case when partnumber='ARMOR-22-256G' then null else now() end
from public.arm_products
where partnumber in ('ARMOR-22-256G','ARMOR-25TPro-256GB','ARMOR-X12Pro','ARMOR-X13')
on conflict(workspace_id,arm_partnumber) do nothing;
