-- ARM CRM: human queue is not assignment. Claims are atomic and workspace-authorized.
-- No ERP data or public WhatsApp sending is changed by this migration.
alter table public.arm_threads
  add column if not exists human_queued_at timestamptz,
  add column if not exists human_assigned_at timestamptz;

create table if not exists public.arm_handoff_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  thread_id uuid not null,
  action text not null check(action in ('queued','claimed','released','closed','reopened','changed')),
  actor_id uuid references auth.users(id),
  previous_status text not null,
  new_status text not null,
  previous_assigned_to uuid,
  new_assigned_to uuid,
  occurred_at timestamptz not null default now(),
  foreign key (workspace_id,thread_id) references public.arm_threads(workspace_id,id) on delete cascade
);
create index if not exists arm_handoff_audit_thread_time
  on public.arm_handoff_audit(workspace_id,thread_id,occurred_at desc);
alter table public.arm_handoff_audit enable row level security;
revoke all on public.arm_handoff_audit from public,anon,authenticated;
grant select on public.arm_handoff_audit to authenticated;
drop policy if exists arm_handoff_audit_read on public.arm_handoff_audit;
create policy arm_handoff_audit_read on public.arm_handoff_audit for select to authenticated
  using (exists (select 1 from public.arm_workspaces w where w.id=workspace_id));

create or replace function public.arm_log_handoff_transition()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_action text;
begin
 if old.status is not distinct from new.status and old.assigned_to is not distinct from new.assigned_to then
   return new;
 end if;
 v_action := case
   when old.status='pending' and new.status='human' then 'queued'
   when new.status='closed' then 'closed'
   when old.status='closed' and new.status='human' then 'reopened'
   when old.assigned_to is null and new.assigned_to is not null then 'claimed'
   when old.assigned_to is not null and new.assigned_to is null then 'released'
   else 'changed' end;
 insert into public.arm_handoff_audit
   (workspace_id,thread_id,action,actor_id,previous_status,new_status,previous_assigned_to,new_assigned_to)
 values (new.workspace_id,new.id,v_action,auth.uid(),old.status,new.status,old.assigned_to,new.assigned_to);
 return new;
end;
$$;
revoke all on function public.arm_log_handoff_transition() from public,anon,authenticated;
drop trigger if exists arm_log_handoff_transition on public.arm_threads;
create trigger arm_log_handoff_transition after update of status,assigned_to on public.arm_threads
 for each row execute function public.arm_log_handoff_transition();

create or replace function public.arm_human_thread_action(
 p_workspace_id uuid, p_thread_id uuid, p_action text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_active boolean;
 v_owner boolean;
 v_staff boolean;
 v_thread public.arm_threads%rowtype;
 v_now timestamptz := now();
begin
 if v_actor is null or p_workspace_id is null or p_thread_id is null or
    p_action not in ('queue','claim','release','close','reopen') then
   raise exception 'ARM_HANDOFF_INVALID_REQUEST' using errcode='42501';
 end if;
 select exists (
   select 1 from public.crm_usuarios cu join auth.users au
     on lower(au.email)=lower(cu.email)
    where au.id=v_actor and cu.activo=true
 ) into v_active;
 if not v_active then
   raise exception 'ARM_HANDOFF_ACCESS_DENIED' using errcode='42501';
 end if;
 select exists(select 1 from public.arm_workspaces w
   where w.id=p_workspace_id and w.owner_id=v_actor) into v_owner;
 select exists(select 1 from public.arm_memberships m
   where m.workspace_id=p_workspace_id and m.user_id=v_actor
   and m.role in ('seller','admin')) into v_staff;
 if not (v_owner or v_staff) then
   raise exception 'ARM_HANDOFF_ACCESS_DENIED' using errcode='42501';
 end if;
 select * into v_thread from public.arm_threads
   where id=p_thread_id and workspace_id=p_workspace_id for update;
 if not found then
   raise exception 'ARM_HANDOFF_NOT_FOUND' using errcode='P0002';
 end if;
 if p_action='queue' and v_thread.status='pending' and v_thread.assigned_to is null then
   update public.arm_threads set status='human',human_queued_at=v_now
     where id=p_thread_id and workspace_id=p_workspace_id;
 elsif p_action='claim' and v_thread.status='human' and v_thread.assigned_to is null then
   update public.arm_threads set assigned_to=v_actor,human_assigned_at=v_now
     where id=p_thread_id and workspace_id=p_workspace_id;
 elsif p_action='release' and v_thread.status='human' and
    (v_thread.assigned_to=v_actor or v_owner) and v_thread.assigned_to is not null then
   update public.arm_threads set assigned_to=null,human_assigned_at=null,human_queued_at=v_now
     where id=p_thread_id and workspace_id=p_workspace_id;
 elsif p_action='close' and v_thread.status='human' and
    (v_thread.assigned_to=v_actor or v_owner) then
   update public.arm_threads set status='closed'
     where id=p_thread_id and workspace_id=p_workspace_id;
 elsif p_action='reopen' and v_thread.status='closed' and v_owner then
   update public.arm_threads set status='human',assigned_to=null,
     human_assigned_at=null,human_queued_at=v_now
     where id=p_thread_id and workspace_id=p_workspace_id;
 else
   raise exception 'ARM_HANDOFF_STATE_CONFLICT' using errcode='P0001';
 end if;
 select * into v_thread from public.arm_threads
   where id=p_thread_id and workspace_id=p_workspace_id;
 return jsonb_build_object(
   'thread_id',v_thread.id,'status',v_thread.status,
   'assigned_to',v_thread.assigned_to,
   'human_queued_at',v_thread.human_queued_at,
   'human_assigned_at',v_thread.human_assigned_at,
   'action',p_action
 );
end;
$$;
revoke all on function public.arm_human_thread_action(uuid,uuid,text) from public,anon;
grant execute on function public.arm_human_thread_action(uuid,uuid,text) to authenticated;
-- Grant only the original read permission; all human actions must go through the RPC.
revoke update on public.arm_threads from authenticated;
revoke update(status) on public.arm_threads from authenticated;
