-- Private sandbox inventory for ARM-CRM. These numbers must NEVER be promoted
-- to arm_stock_levels or commercial approvals by the AI.
alter table public.arm_offer_simulations
  add column if not exists stock_units_demo integer;

alter table public.arm_offer_simulations
  drop constraint if exists arm_offer_simulations_demo_units_check;

alter table public.arm_offer_simulations
  add constraint arm_offer_simulations_demo_units_check
  check (
    stock_units_demo is null or
    (stock_units_demo between 0 and 10000 and is_test_data is true)
  );

update public.arm_offer_simulations o
set stock_units_demo=v.units,
    stock_status=case when v.units>0 then 'disponible' else 'no disponible' end,
    updated_at=now()
from (values
 ('ARMOR-22-256G',8),
 ('ARMOR-25TPro-256GB',3),
 ('ARMOR-X12Pro',0),
 ('ARMOR-X13',5)
) as v(pn,units)
where o.partnumber=v.pn
  and o.is_test_data is true
  and exists (
    select 1 from public.arm_workspaces w
    where w.id=o.workspace_id and w.name='STECH PERU'
  );

comment on column public.arm_offer_simulations.stock_units_demo is
 'Assumed units for private AI training only. Not a commercial inventory source, reservation or customer promise.';
