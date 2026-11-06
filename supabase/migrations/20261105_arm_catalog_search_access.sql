-- Security-invoker search obeys arm_products workspace RLS.
-- Internal CRM chat uses authenticated JWT; signed WhatsApp uses service_role.
revoke execute on function public.arm_search_catalog(uuid,text,int) from PUBLIC,anon;
grant execute on function public.arm_search_catalog(uuid,text,int) to authenticated,service_role;
-- Verified product facts are readable by authenticated workspace members only.
grant select on public.arm_product_facts to authenticated;
drop policy if exists arm_product_facts_workspace_read on public.arm_product_facts;
create policy arm_product_facts_workspace_read on public.arm_product_facts
 for select to authenticated using (
   exists (select 1 from public.arm_workspaces w
           where w.id=arm_product_facts.workspace_id)
 );
revoke all on public.arm_product_facts from anon;
comment on policy arm_product_facts_workspace_read on public.arm_product_facts
 is 'Workspace membership enforced by arm_workspaces RLS. No browser writes; backend only uses verified nonexpired facts.';
