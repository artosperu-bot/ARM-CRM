-- Keep public RPC invoker-only; privileged logic lives in a non-exposed schema.
create schema if not exists arm_private;
revoke all on schema arm_private from public,anon;
grant usage on schema arm_private to authenticated;
create or replace function arm_private.arm_human_thread_action(
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
revoke all on function arm_private.arm_human_thread_action(uuid,uuid,text) from public,anon;
grant execute on function arm_private.arm_human_thread_action(uuid,uuid,text) to authenticated;
drop function public.arm_human_thread_action(uuid,uuid,text);
create function public.arm_human_thread_action(
  p_workspace_id uuid, p_thread_id uuid, p_action text
) returns jsonb language sql security invoker set search_path = ''
as $$
  select arm_private.arm_human_thread_action(p_workspace_id,p_thread_id,p_action)
$$;
revoke all on function public.arm_human_thread_action(uuid,uuid,text) from public,anon;
grant execute on function public.arm_human_thread_action(uuid,uuid,text) to authenticated;
