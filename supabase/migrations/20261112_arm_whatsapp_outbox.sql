-- Durable WhatsApp sandbox outbox. NO automatic replay after an ambiguous Graph send.
create table if not exists public.arm_whatsapp_outbox (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 thread_id uuid not null,
 inbound_id uuid not null references public.arm_messages(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','triaging','ready','sending','sent','skipped','review')),
 kind text check(kind in ('ai_reply','handoff_ack')),
 attempts integer not null default 0 check(attempts>=0),
 next_attempt_at timestamptz not null default now(),
 last_error text,
 provider_message_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 delivered_at timestamptz,
 delivery_status text check(delivery_status in ('sent','delivered','read','failed','unknown')),
 unique(workspace_id,inbound_id),
 foreign key(workspace_id,thread_id) references public.arm_threads(workspace_id,id) on delete cascade
);
create index if not exists arm_whatsapp_outbox_claim on public.arm_whatsapp_outbox(state,next_attempt_at,created_at);
create index if not exists arm_whatsapp_outbox_provider_id on public.arm_whatsapp_outbox(provider_message_id) where provider_message_id is not null;
alter table public.arm_whatsapp_outbox enable row level security;
revoke all on public.arm_whatsapp_outbox from public,anon,authenticated;
grant select,insert,update on public.arm_whatsapp_outbox to service_role;

-- The same database transaction that stores an inbound WhatsApp message creates
-- its durable work item. No queued message is sent unless the PC020 gateway
-- independently verifies the phone ID and two-number sender allowlist.
create or replace function public.arm_enqueue_whatsapp_inbound()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.direction='inbound' and new.provider='whatsapp'
    and new.message_type='text' and new.content is not null
    and new.thread_id is not null and
    exists (select 1 from public.arm_threads t
      join public.arm_meta_accounts a on a.workspace_id=t.workspace_id
        and a.channel='whatsapp' and a.account_ref=t.external_account_ref
      where t.id=new.thread_id and t.workspace_id=new.workspace_id
        and a.inbound_enabled and a.status='verified_read_only')
 then
   insert into public.arm_whatsapp_outbox(workspace_id,thread_id,inbound_id)
     values(new.workspace_id,new.thread_id,new.id)
     on conflict(workspace_id,inbound_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.arm_enqueue_whatsapp_inbound() from public,anon,authenticated;
drop trigger if exists arm_enqueue_whatsapp_inbound on public.arm_messages;
create trigger arm_enqueue_whatsapp_inbound after insert on public.arm_messages
 for each row execute function public.arm_enqueue_whatsapp_inbound();

-- Atomic claim; only a service-role worker can dequeue. No retry of a row
-- already marked 'sending': it may have been accepted by Graph.
create or replace function public.arm_claim_whatsapp_outbox(p_phase text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare v_job public.arm_whatsapp_outbox%rowtype;
begin
 if current_user <> 'service_role' or p_phase not in ('triage','send') then
   raise exception 'ARM_OUTBOX_ACCESS_DENIED' using errcode='42501';
 end if;
 select * into v_job from public.arm_whatsapp_outbox j
   where j.state=case when p_phase='triage' then 'pending' else 'ready' end
     and j.next_attempt_at<=now()
   order by j.created_at,j.id
   for update skip locked limit 1;
 if not found then return null; end if;
 update public.arm_whatsapp_outbox
    set state=case when p_phase='triage' then 'triaging' else 'sending' end,
        attempts=attempts+1,updated_at=now()
   where id=v_job.id returning * into v_job;
 return to_jsonb(v_job);
end;
$$;
revoke all on function public.arm_claim_whatsapp_outbox(text) from public,anon,authenticated;
grant execute on function public.arm_claim_whatsapp_outbox(text) to service_role;
