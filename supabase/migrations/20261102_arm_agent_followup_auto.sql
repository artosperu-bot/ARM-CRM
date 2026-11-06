-- Agent CRM approved follow-up in one atomic operation; do not expose ID collection.
alter table public.arm_followups add column if not exists agent_conversation_id uuid references public.arm_agent_conversations(id);
create unique index if not exists arm_followups_one_agent_conversation
on public.arm_followups(workspace_id,agent_conversation_id) where agent_conversation_id is not null;
create or replace function public.arm_book_agent_followup(
 p_workspace_id uuid,p_conversation_id uuid,p_full_name text,p_phone text,
 p_due_at timestamptz,p_description text,p_consent boolean
) returns table(followup_id uuid,contact_id uuid,already_scheduled boolean)
language plpgsql security invoker set search_path=''
as $body$
declare v_user uuid;v_contact uuid;v_followup uuid;v_name text;v_phone text;
begin
 v_user:=(select auth.uid());v_name:=trim(p_full_name);
 v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if v_user is null or p_consent is distinct from true then raise exception 'CONSENT_REQUIRED';end if;
 if char_length(v_name)<5 or char_length(v_name)>120 or array_length(regexp_split_to_array(v_name,'\s+'),1)<2 then raise exception 'FULL_NAME_REQUIRED';end if;
 if char_length(v_phone)=11 and left(v_phone,2)='51' then v_phone:=right(v_phone,9);end if;
 if v_phone !~ '^9[0-9]{8}$' then raise exception 'PHONE_REQUIRED';end if;
 if p_due_at is null or p_due_at<=now()+interval '10 minutes' or p_due_at>now()+interval '90 days' then raise exception 'INVALID_FOLLOWUP_DATE';end if;
 if char_length(trim(p_description)) not between 8 and 400 then raise exception 'INVALID_DESCRIPTION';end if;
 if not exists(select 1 from public.arm_agent_conversations c where c.id=p_conversation_id and c.workspace_id=p_workspace_id and c.created_by=v_user) then raise exception 'CONVERSATION_NOT_AUTHORIZED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_conversation_id::text,0));
 select f.id,f.contact_id into v_followup,v_contact from public.arm_followups f where f.workspace_id=p_workspace_id and f.agent_conversation_id=p_conversation_id;
 if v_followup is not null then return query select v_followup,v_contact,true;return;end if;
 select c.id into v_contact from public.arm_contacts c
 where c.workspace_id=p_workspace_id and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') in (v_phone,'51'||v_phone)
 order by c.created_at limit 1;
 if v_contact is null then
  insert into public.arm_contacts(workspace_id,display_name,phone,source,notes)
   values(p_workspace_id,v_name,v_phone,'web','Contacto autorizado para seguimiento comercial') returning id into v_contact;
 end if;
 insert into public.arm_followups(workspace_id,contact_id,agent_conversation_id,description,due_at,status)
 values(p_workspace_id,v_contact,p_conversation_id,trim(p_description),p_due_at,'pending') returning id into v_followup;
 return query select v_followup,v_contact,false;
end;$body$;
revoke execute on function public.arm_book_agent_followup(uuid,uuid,text,text,timestamptz,text,boolean) from public,anon;
grant execute on function public.arm_book_agent_followup(uuid,uuid,text,text,timestamptz,text,boolean) to authenticated;
