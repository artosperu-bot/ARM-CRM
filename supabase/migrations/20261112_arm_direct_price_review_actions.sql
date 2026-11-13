-- Controlled manual price approval for STECH direct channel. No stock approvals.
-- The review remains unusable for saleable stock until independent multi-channel reconciliation.
create table if not exists public.arm_commercial_price_audit(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 partnumber text not null,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('approve','revoke')),
 previous_price_pen numeric(14,2),
 new_price_pen numeric(14,2),
 source_ref text,
 note text not null,
 occurred_at timestamptz not null default now(),
 foreign key(workspace_id,partnumber)
   references public.arm_products(workspace_id,partnumber) on delete cascade
);
alter table public.arm_commercial_price_audit enable row level security;
revoke all on public.arm_commercial_price_audit from public,anon,authenticated;
grant select on public.arm_commercial_price_audit to authenticated;
create policy arm_price_audit_read on public.arm_commercial_price_audit
 for select to authenticated using(
  exists(select 1 from public.arm_workspaces w
    where w.id=arm_commercial_price_audit.workspace_id));
grant select,insert on public.arm_commercial_price_audit to service_role;

create schema if not exists arm_private;
revoke all on schema arm_private from public,anon;
grant usage on schema arm_private to authenticated;

create or replace function arm_private.arm_record_direct_price(
 p_workspace_id uuid,p_partnumber text,p_action text,
 p_price_pen numeric,p_source_ref text,p_note text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid:=auth.uid();
 v_active_admin boolean;
 v_owner boolean;
 v_partnumber text:=btrim(coalesce(p_partnumber,''));
 v_price numeric(14,2);
 v_previous numeric(14,2);
 v_row public.arm_commercial_reviews%rowtype;
begin
 if v_actor is null or p_workspace_id is null or length(v_partnumber)<3
    or p_action is null or p_action not in ('approve','revoke')
    or length(btrim(coalesce(p_note,'')))<10
    or length(p_note)>600 then
   raise exception 'ARM_PRICE_INVALID_INPUT' using errcode='22023';
 end if;
 select exists(
  select 1 from public.crm_usuarios cu join auth.users u
    on lower(u.email)=lower(cu.email)
   where u.id=v_actor and cu.activo and cu.rol='ADMIN'
 ) into v_active_admin;
 select exists(select 1 from public.arm_workspaces w
   where w.id=p_workspace_id and w.owner_id=v_actor) into v_owner;
 if not (v_active_admin and v_owner) then
   raise exception 'ARM_PRICE_ACCESS_DENIED' using errcode='42501';
 end if;
 if p_action='approve' then
   if p_price_pen is null or p_price_pen<=0 or p_price_pen>999999.99
      or p_price_pen<>round(p_price_pen,2)
      or length(btrim(coalesce(p_source_ref,'')))<8
      or length(p_source_ref)>320 then
     raise exception 'ARM_PRICE_EVIDENCE_REQUIRED' using errcode='22023';
   end if;
   v_price:=p_price_pen;
 end if;
 perform 1 from public.arm_products where workspace_id=p_workspace_id
   and partnumber=v_partnumber for update;
 if not found then raise exception 'ARM_PRICE_UNKNOWN_SKU' using errcode='P0002'; end if;
 select price_pen into v_previous from public.arm_commercial_reviews
   where workspace_id=p_workspace_id and partnumber=v_partnumber;
 if p_action='approve' then
   insert into public.arm_commercial_reviews
    (workspace_id,partnumber,review_state,reviewer_id,review_note,
     price_pen,price_source_ref,price_reviewed_at,price_expires_at,last_reviewed_at)
   values(p_workspace_id,v_partnumber,'approved',v_actor,btrim(p_note),
          v_price,btrim(p_source_ref),now(),now()+interval '6 hours',now())
   on conflict(workspace_id,partnumber) do update set
    review_state='approved',reviewer_id=excluded.reviewer_id,
    review_note=excluded.review_note,price_pen=excluded.price_pen,
    price_source_ref=excluded.price_source_ref,
    price_reviewed_at=excluded.price_reviewed_at,
    price_expires_at=excluded.price_expires_at,
    last_reviewed_at=excluded.last_reviewed_at,updated_at=now();
 else
   update public.arm_commercial_reviews set review_state='revoked',
      reviewer_id=v_actor,review_note=btrim(p_note),
      price_pen=null,price_source_ref=null,price_reviewed_at=null,
      price_expires_at=null,last_reviewed_at=now(),updated_at=now()
   where workspace_id=p_workspace_id and partnumber=v_partnumber;
   if not found then raise exception 'ARM_PRICE_NOT_REVIEWED' using errcode='P0002'; end if;
 end if;
 insert into public.arm_commercial_price_audit
 (workspace_id,partnumber,actor_id,action,previous_price_pen,new_price_pen,source_ref,note)
 values(p_workspace_id,v_partnumber,v_actor,p_action,v_previous,v_price,
        case when p_action='approve' then btrim(p_source_ref) else null end,btrim(p_note));
 select * into v_row from public.arm_commercial_reviews
 where workspace_id=p_workspace_id and partnumber=v_partnumber;
 return jsonb_build_object('partnumber',v_partnumber,'state',v_row.review_state,
  'price_pen',v_row.price_pen,'expires_at',v_row.price_expires_at,
  'stock_not_approved',true,'action',p_action);
end;
$$;
revoke all on function arm_private.arm_record_direct_price(uuid,text,text,numeric,text,text) from public,anon;
grant execute on function arm_private.arm_record_direct_price(uuid,text,text,numeric,text,text) to authenticated;
create or replace function public.arm_record_direct_price(
 p_workspace_id uuid,p_partnumber text,p_action text,
 p_price_pen numeric,p_source_ref text,p_note text
) returns jsonb language sql security invoker set search_path = ''
as $$
 select arm_private.arm_record_direct_price(
   p_workspace_id,p_partnumber,p_action,p_price_pen,p_source_ref,p_note)
$$;
revoke all on function public.arm_record_direct_price(uuid,text,text,numeric,text,text) from public,anon;
grant execute on function public.arm_record_direct_price(uuid,text,text,numeric,text,text) to authenticated;
