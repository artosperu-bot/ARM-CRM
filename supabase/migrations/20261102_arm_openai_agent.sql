-- STECH ARM-CRM: conversaciones supervisadas con OpenAI, nuevas y sin datos demo.
-- Aplicado al Supabase operativo iipamvqbipbolchlozoj el 02/11/2026.
create table if not exists public.arm_agent_conversations(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 title text not null check(char_length(title) between 1 and 140),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id)
);
create index if not exists arm_agent_conv_user_latest
 on public.arm_agent_conversations(workspace_id,created_by,updated_at desc);
create table if not exists public.arm_agent_turns(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
 conversation_id uuid not null,
 created_by uuid not null references auth.users(id),
 role text not null check(role in ('user','assistant')),
 content text not null check(char_length(content) between 1 and 8000),
 created_at timestamptz not null default now(),
 foreign key(workspace_id,conversation_id) references public.arm_agent_conversations(workspace_id,id)
);
create index if not exists arm_agent_turns_history
 on public.arm_agent_turns(workspace_id,conversation_id,created_at);
alter table public.arm_agent_conversations enable row level security;
alter table public.arm_agent_turns enable row level security;
revoke all privileges on public.arm_agent_conversations,public.arm_agent_turns from anon,authenticated;
grant select,insert on public.arm_agent_conversations,public.arm_agent_turns to authenticated;
create policy arm_agent_conv_read on public.arm_agent_conversations for select to authenticated
 using(created_by=(select auth.uid()) and workspace_id in (select id from public.arm_workspaces));
create policy arm_agent_conv_create on public.arm_agent_conversations for insert to authenticated
 with check(created_by=(select auth.uid()) and workspace_id in (select id from public.arm_workspaces));
create policy arm_agent_turns_read on public.arm_agent_turns for select to authenticated
 using(created_by=(select auth.uid()) and exists(select 1 from public.arm_agent_conversations c
 where c.id=conversation_id and c.workspace_id=workspace_id and c.created_by=(select auth.uid())));
create policy arm_agent_turns_create on public.arm_agent_turns for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.arm_agent_conversations c
 where c.id=conversation_id and c.workspace_id=workspace_id and c.created_by=(select auth.uid())));
grant insert on public.arm_ai_usage to authenticated;
grant usage on sequence public.arm_ai_usage_id_seq to authenticated;
create policy arm_agent_usage_write on public.arm_ai_usage for insert to authenticated with check(
 source='arm_agent' and cost_source in ('unavailable','rate_card_estimate')
 and workspace_id in (select id from public.arm_workspaces)
 and exists (select 1 from public.arm_agent_conversations c
  where c.id::text=session_id and c.workspace_id=workspace_id and c.created_by=(select auth.uid()))
);
