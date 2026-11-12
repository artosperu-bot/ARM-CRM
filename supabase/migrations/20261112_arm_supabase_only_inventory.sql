-- Supabase-only pilot inventory. No PC005, ERP, distributor or SQL Server dependency.
-- Manual authorization is not a completed order; all holds are atomic and auditable.
create table if not exists public.arm_stock_levels (
 workspace_id uuid not null,
 partnumber text not null,
 on_hand integer not null default 0 check(on_hand >= 0),
 approved boolean not null default false,
 source_ref text,
 review_note text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 expires_at timestamptz,
 version bigint not null default 0,
 updated_at timestamptz not null default now(),
 primary key(workspace_id,partnumber),
 foreign key(workspace_id,partnumber)
   references public.arm_products(workspace_id,partnumber) on delete cascade,
 constraint arm_stock_review_complete check(not approved or (
   reviewed_by is not null and length(btrim(coalesce(source_ref,'')))>=8
   and length(btrim(coalesce(review_note,'')))>=10
   and reviewed_at is not null and expires_at>reviewed_at
   and expires_at<=reviewed_at+interval '60 minutes'))
);
create table if not exists public.arm_stock_reservations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 partnumber text not null,
 quantity integer not null check(quantity between 1 and 100),
 idempotency_key text not null,
 status text not null default 'held' check(status in ('held','released','expired')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 released_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(workspace_id,idempotency_key),
 foreign key(workspace_id,partnumber)
   references public.arm_stock_levels(workspace_id,partnumber) on delete cascade
);
create index if not exists arm_stock_reservations_active_idx
 on public.arm_stock_reservations(workspace_id,partnumber,expires_at)
 where status='held';
create table if not exists public.arm_stock_events (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 partnumber text not null,
 actor_id uuid not null references auth.users(id),
 event_type text not null check(event_type in ('approve','suspend','reserve','release')),
 reservation_id uuid references public.arm_stock_reservations(id),
 quantity integer not null default 0,
 note text,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,partnumber)
   references public.arm_stock_levels(workspace_id,partnumber) on delete cascade
);
create index if not exists arm_stock_events_recent_idx on public.arm_stock_events(workspace_id,partnumber,created_at desc);
alter table public.arm_stock_levels enable row level security;
alter table public.arm_stock_reservations enable row level security;
alter table public.arm_stock_events enable row level security;
revoke all on public.arm_stock_levels,public.arm_stock_reservations,public.arm_stock_events
 from public,anon,authenticated;
grant select on public.arm_stock_levels,public.arm_stock_reservations,public.arm_stock_events to authenticated;
grant select,insert,update,delete on public.arm_stock_levels,public.arm_stock_reservations,public.arm_stock_events to service_role;
create policy arm_stock_levels_read on public.arm_stock_levels for select to authenticated
 using(exists(select 1 from public.arm_workspaces w where w.id=workspace_id));
create policy arm_stock_reservations_read on public.arm_stock_reservations for select to authenticated
 using(exists(select 1 from public.arm_workspaces w where w.id=workspace_id));
create policy arm_stock_events_read on public.arm_stock_events for select to authenticated
 using(exists(select 1 from public.arm_workspaces w where w.id=workspace_id));

create schema if not exists arm_private;
revoke all on schema arm_private from public,anon;
grant usage on schema arm_private to authenticated;

create or replace function arm_private.arm_stock_authorize(p_workspace uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid := auth.uid();
begin
 if v_actor is null or p_workspace is null or not exists (
   select 1 from public.arm_workspaces w where w.id=p_workspace and w.owner_id=v_actor
 ) or not exists (
   select 1 from public.crm_usuarios cu join auth.users u on lower(cu.email)=lower(u.email)
   where u.id=v_actor and cu.activo=true and cu.rol='ADMIN'
 ) then
   raise exception 'ARM_STOCK_ACCESS_DENIED' using errcode='42501';
 end if;
 return v_actor;
end $$;
revoke all on function arm_private.arm_stock_authorize(uuid) from public,anon,authenticated;

create or replace function arm_private.arm_manage_stock(
 p_workspace_id uuid,p_partnumber text,p_action text,
 p_on_hand integer,p_source_ref text,p_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid;v_held bigint;v_available integer;v_level public.arm_stock_levels%rowtype;
begin
 v_actor:=arm_private.arm_stock_authorize(p_workspace_id);
 if p_partnumber is null or length(btrim(p_partnumber))<3
   or p_action is null or p_action not in ('approve','suspend')
   or length(btrim(coalesce(p_note,'')))<10 or length(p_note)>600 then
   raise exception 'ARM_STOCK_INVALID_INPUT' using errcode='22023';
 end if;
 if p_action='approve' and (p_on_hand is null or p_on_hand<0 or p_on_hand>100000
    or length(btrim(coalesce(p_source_ref,'')))<8 or length(p_source_ref)>320) then
   raise exception 'ARM_STOCK_SOURCE_REQUIRED' using errcode='22023';
 end if;
 perform 1 from public.arm_products
 where workspace_id=p_workspace_id and partnumber=p_partnumber for update;
 if not found then raise exception 'ARM_STOCK_UNKNOWN_SKU' using errcode='P0002'; end if;
 insert into public.arm_stock_levels(workspace_id,partnumber)
 values(p_workspace_id,p_partnumber) on conflict do nothing;
 select * into v_level from public.arm_stock_levels
 where workspace_id=p_workspace_id and partnumber=p_partnumber for update;
 select coalesce(sum(quantity),0) into v_held from public.arm_stock_reservations
 where workspace_id=p_workspace_id and partnumber=p_partnumber
   and status='held' and expires_at>now();
 if p_action='approve' then
   if p_on_hand<v_held then
     raise exception 'ARM_STOCK_BELOW_ACTIVE_RESERVATIONS' using errcode='P0001';
   end if;
   update public.arm_stock_levels set on_hand=p_on_hand,approved=true,
      source_ref=btrim(p_source_ref),review_note=btrim(p_note),reviewed_by=v_actor,
      reviewed_at=now(),expires_at=now()+interval '60 minutes',
      version=version+1,updated_at=now()
   where workspace_id=p_workspace_id and partnumber=p_partnumber
   returning * into v_level;
 else
   update public.arm_stock_levels set approved=false,review_note=btrim(p_note),
      reviewed_by=v_actor,expires_at=now(),version=version+1,updated_at=now()
   where workspace_id=p_workspace_id and partnumber=p_partnumber
   returning * into v_level;
 end if;
 insert into public.arm_stock_events
   (workspace_id,partnumber,actor_id,event_type,quantity,note)
 values(p_workspace_id,p_partnumber,v_actor,p_action,v_level.on_hand,btrim(p_note));
 v_available:=greatest(0,v_level.on_hand-v_held);
 return jsonb_build_object('partnumber',p_partnumber,'approved',v_level.approved,
   'on_hand',v_level.on_hand,'held',v_held,'available',v_available,
   'expires_at',v_level.expires_at,'version',v_level.version);
end $$;
revoke all on function arm_private.arm_manage_stock(uuid,text,text,integer,text,text) from public,anon;
grant execute on function arm_private.arm_manage_stock(uuid,text,text,integer,text,text) to authenticated;
create or replace function public.arm_manage_stock(
 p_workspace_id uuid,p_partnumber text,p_action text,
 p_on_hand integer,p_source_ref text,p_note text
) returns jsonb language sql security invoker set search_path=''
as $$ select arm_private.arm_manage_stock(p_workspace_id,p_partnumber,p_action,p_on_hand,p_source_ref,p_note) $$;
revoke all on function public.arm_manage_stock(uuid,text,text,integer,text,text) from public,anon;
grant execute on function public.arm_manage_stock(uuid,text,text,integer,text,text) to authenticated;

create or replace function arm_private.arm_hold_stock(
 p_workspace_id uuid,p_partnumber text,p_quantity integer,
 p_idempotency_key text,p_ttl_minutes integer default 15
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid;v_level public.arm_stock_levels%rowtype;
 v_old public.arm_stock_reservations%rowtype;v_new public.arm_stock_reservations%rowtype;
 v_held bigint;
begin
 v_actor:=arm_private.arm_stock_authorize(p_workspace_id);
 if p_partnumber is null or length(btrim(p_partnumber))<3
   or p_quantity is null or p_quantity not between 1 and 100
   or length(btrim(coalesce(p_idempotency_key,'')))<12 or length(p_idempotency_key)>128
   or p_ttl_minutes is null or p_ttl_minutes not between 5 and 60 then
  raise exception 'ARM_HOLD_INVALID_INPUT' using errcode='22023';
 end if;
 -- All writers lock the SAME product first. This serializes competing holds
 -- and stock adjustments within a workspace/SKU.
 perform 1 from public.arm_products where workspace_id=p_workspace_id
  and partnumber=p_partnumber for update;
 if not found then raise exception 'ARM_HOLD_UNKNOWN_SKU' using errcode='P0002'; end if;
 select * into v_old from public.arm_stock_reservations
  where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
   if v_old.partnumber<>p_partnumber or v_old.quantity<>p_quantity then
     raise exception 'ARM_HOLD_KEY_REUSED' using errcode='P0001';
   end if;
   return jsonb_build_object('reservation_id',v_old.id,'status',v_old.status,
    'expires_at',v_old.expires_at,'already_exists',true);
 end if;
 select * into v_level from public.arm_stock_levels
  where workspace_id=p_workspace_id and partnumber=p_partnumber for update;
 if not found or not v_level.approved or v_level.reviewed_at is null
   or v_level.expires_at<=now() or v_level.reviewed_at<now()-interval '60 minutes' then
   raise exception 'ARM_HOLD_STOCK_NOT_APPROVED' using errcode='P0001';
 end if;
 select coalesce(sum(quantity),0) into v_held from public.arm_stock_reservations
  where workspace_id=p_workspace_id and partnumber=p_partnumber
   and status='held' and expires_at>now();
 if v_level.on_hand-v_held<p_quantity then
   raise exception 'ARM_HOLD_STOCK_INSUFFICIENT' using errcode='P0001';
 end if;
 insert into public.arm_stock_reservations
  (workspace_id,partnumber,quantity,idempotency_key,created_by,expires_at)
 values(p_workspace_id,p_partnumber,p_quantity,p_idempotency_key,v_actor,
    least(v_level.expires_at,now()+make_interval(mins=>p_ttl_minutes)))
 returning * into v_new;
 insert into public.arm_stock_events
  (workspace_id,partnumber,actor_id,event_type,reservation_id,quantity,note)
 values(p_workspace_id,p_partnumber,v_actor,'reserve',v_new.id,p_quantity,
    'Reserva provisional en Supabase; NO es pedido ni pago');
 return jsonb_build_object('reservation_id',v_new.id,'status',v_new.status,
   'expires_at',v_new.expires_at,'already_exists',false);
end $$;
revoke all on function arm_private.arm_hold_stock(uuid,text,integer,text,integer) from public,anon;
grant execute on function arm_private.arm_hold_stock(uuid,text,integer,text,integer) to authenticated;
create or replace function public.arm_hold_stock(
 p_workspace_id uuid,p_partnumber text,p_quantity integer,
 p_idempotency_key text,p_ttl_minutes integer default 15
) returns jsonb language sql security invoker set search_path=''
as $$ select arm_private.arm_hold_stock(p_workspace_id,p_partnumber,p_quantity,p_idempotency_key,p_ttl_minutes) $$;
revoke all on function public.arm_hold_stock(uuid,text,integer,text,integer) from public,anon;
grant execute on function public.arm_hold_stock(uuid,text,integer,text,integer) to authenticated;

create or replace function arm_private.arm_release_stock(
 p_workspace_id uuid,p_reservation_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid;v_pn text;v_res public.arm_stock_reservations%rowtype;
begin
 v_actor:=arm_private.arm_stock_authorize(p_workspace_id);
 select r.partnumber into v_pn from public.arm_stock_reservations r
  where r.workspace_id=p_workspace_id and r.id=p_reservation_id;
 if not found then raise exception 'ARM_RELEASE_NOT_FOUND' using errcode='P0002'; end if;
 perform 1 from public.arm_products where workspace_id=p_workspace_id
  and partnumber=v_pn for update;
 select * into v_res from public.arm_stock_reservations
  where workspace_id=p_workspace_id and id=p_reservation_id for update;
 if v_res.status='held' then
   update public.arm_stock_reservations set status='released',
    released_at=now(),updated_at=now()
   where id=p_reservation_id returning * into v_res;
   insert into public.arm_stock_events
    (workspace_id,partnumber,actor_id,event_type,reservation_id,quantity,note)
   values(p_workspace_id,v_res.partnumber,v_actor,'release',
     v_res.id,v_res.quantity,'Reserva provisional liberada');
 end if;
 return jsonb_build_object('reservation_id',v_res.id,'status',v_res.status);
end $$;
revoke all on function arm_private.arm_release_stock(uuid,uuid) from public,anon;
grant execute on function arm_private.arm_release_stock(uuid,uuid) to authenticated;
create or replace function public.arm_release_stock(
 p_workspace_id uuid,p_reservation_id uuid
) returns jsonb language sql security invoker set search_path=''
as $$ select arm_private.arm_release_stock(p_workspace_id,p_reservation_id) $$;
revoke all on function public.arm_release_stock(uuid,uuid) from public,anon;
grant execute on function public.arm_release_stock(uuid,uuid) to authenticated;

create or replace function public.arm_stock_snapshot(
 p_workspace_id uuid,p_partnumbers text[]
) returns table (
 workspace_id uuid,partnumber text,on_hand integer,approved boolean,
 source_ref text,reviewed_at timestamptz,expires_at timestamptz,
 held_units bigint,available_units bigint
) language sql stable security invoker set search_path=''
as $$
 select s.workspace_id,s.partnumber,s.on_hand,s.approved,s.source_ref,s.reviewed_at,s.expires_at,
  coalesce(r.held,0)::bigint as held_units,
  greatest(0,s.on_hand-coalesce(r.held,0))::bigint as available_units
 from public.arm_stock_levels s
 left join lateral (
   select coalesce(sum(z.quantity),0)::bigint as held
   from public.arm_stock_reservations z
   where z.workspace_id=s.workspace_id and z.partnumber=s.partnumber
     and z.status='held' and z.expires_at>now()
 ) r on true
 where s.workspace_id=p_workspace_id
   and cardinality(coalesce(p_partnumbers, '{}'::text[])) between 1 and 30
   and s.partnumber=any(p_partnumbers)
 order by s.partnumber
$$;
revoke all on function public.arm_stock_snapshot(uuid,text[]) from public,anon;
grant execute on function public.arm_stock_snapshot(uuid,text[]) to authenticated,service_role;
comment on function public.arm_stock_snapshot(uuid,text[]) is
 'Current, workspace-isolated internal Supabase pilot stock. Not an order/payment confirmation.';
