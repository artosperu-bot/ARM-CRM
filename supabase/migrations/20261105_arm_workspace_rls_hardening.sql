-- Harden cross-workspace membership checks and stop self-equality authorization bugs.
-- Existing arm_workspaces SELECT RLS remains the active-user and membership gate.
-- Changes are limited to ARM-specific policies. All altered policies already exist.

alter policy arm_contacts_select on public.arm_contacts using (exists (select 1 from public.arm_workspaces w where w.id=public.arm_contacts.workspace_id));
alter policy arm_contacts_update on public.arm_contacts using ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_contacts.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_contacts.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_contacts.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller'))))) with check ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_contacts.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_contacts.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_contacts.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))));
alter policy arm_contacts_insert on public.arm_contacts with check ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_contacts.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_contacts.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_contacts.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))));

alter policy arm_deals_select on public.arm_deals using (exists (select 1 from public.arm_workspaces w where w.id=public.arm_deals.workspace_id));
alter policy arm_deals_update on public.arm_deals using ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_deals.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_deals.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_deals.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller'))))) with check ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_deals.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_deals.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_deals.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))));
alter policy arm_deals_insert on public.arm_deals with check ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_deals.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_deals.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_deals.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))));

alter policy arm_followups_select on public.arm_followups using (exists (select 1 from public.arm_workspaces w where w.id=public.arm_followups.workspace_id));
alter policy arm_followups_update on public.arm_followups using ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_followups.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_followups.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_followups.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller'))))) with check ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_followups.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_followups.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_followups.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))));
alter policy arm_followups_insert on public.arm_followups with check ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_followups.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_followups.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_followups.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))));

alter policy arm_threads_select on public.arm_threads using (exists (select 1 from public.arm_workspaces w where w.id=public.arm_threads.workspace_id));
alter policy arm_threads_update on public.arm_threads using ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_threads.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_threads.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_threads.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller'))))) with check ((exists (select 1 from public.arm_workspaces w where w.id=public.arm_threads.workspace_id) and (exists (select 1 from public.arm_workspaces w where w.id=public.arm_threads.workspace_id and w.owner_id=(select auth.uid())) or exists (select 1 from public.arm_memberships m where m.workspace_id=public.arm_threads.workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))));

alter policy arm_offer_simulations_read on public.arm_offer_simulations using (
 exists (select 1 from public.arm_workspaces w where w.id=public.arm_offer_simulations.workspace_id)
);
alter policy arm_agent_turns_create on public.arm_agent_turns with check (
 created_by=(select auth.uid()) and exists(
   select 1 from public.arm_agent_conversations c
   where c.id=public.arm_agent_turns.conversation_id
     and c.workspace_id=public.arm_agent_turns.workspace_id
     and c.created_by=(select auth.uid())
 ));
alter policy arm_agent_turns_read on public.arm_agent_turns using (
 created_by=(select auth.uid()) and exists(
   select 1 from public.arm_agent_conversations c
   where c.id=public.arm_agent_turns.conversation_id
     and c.workspace_id=public.arm_agent_turns.workspace_id
     and c.created_by=(select auth.uid())
 ));
alter policy arm_agent_usage_write on public.arm_ai_usage with check (
  source='arm_agent' and cost_source in ('unavailable','rate_card_estimate')
  and exists(select 1 from public.arm_workspaces w where w.id=public.arm_ai_usage.workspace_id)
  and exists(select 1 from public.arm_agent_conversations c
    where c.id::text=public.arm_ai_usage.session_id
    and c.workspace_id=public.arm_ai_usage.workspace_id
    and c.created_by=(select auth.uid()))
);
