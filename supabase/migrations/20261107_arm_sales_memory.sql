-- ARM-CRM only: minimal durable buyer facts for ALEX.
-- Additive migration. Does not change DB_ST/PC005, legacy CRM or sales orders.
-- JSON must contain only deterministic buyer facts; never raw messages or PII.
alter table public.arm_agent_conversations
 add column if not exists sales_memory jsonb not null default '{}'::jsonb;
alter table public.arm_lead_insights
 add column if not exists sales_memory jsonb not null default '{}'::jsonb;

alter table public.arm_agent_conversations
 add constraint arm_agent_sales_memory_shape
 check (jsonb_typeof(sales_memory)='object' and octet_length(sales_memory::text)<=4096);
alter table public.arm_lead_insights
 add constraint arm_lead_sales_memory_shape
 check (jsonb_typeof(sales_memory)='object' and octet_length(sales_memory::text)<=4096);

-- The internal agent uses a user's JWT. Give it UPDATE access only to the
-- memory column and only to conversations belonging to that user/workspace.
grant update(sales_memory) on public.arm_agent_conversations to authenticated;
drop policy if exists arm_agent_conv_update_sales_memory on public.arm_agent_conversations;
create policy arm_agent_conv_update_sales_memory
 on public.arm_agent_conversations for update to authenticated
 using (
  created_by=(select auth.uid())
  and exists(select 1 from public.arm_workspaces w
   where w.id=arm_agent_conversations.workspace_id)
 )
 with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.arm_workspaces w
   where w.id=arm_agent_conversations.workspace_id)
 );

-- WhatsApp memory is written only by the trusted, allowlisted service role.
-- Authenticated CRM users keep read-only permissions on arm_lead_insights.
comment on column public.arm_agent_conversations.sales_memory is
 'ALEX minimal commercial memory; user-owned internal agent conversation.';
comment on column public.arm_lead_insights.sales_memory is
 'ALEX minimal commercial memory; server-only WhatsApp triage, not customer consent.';
