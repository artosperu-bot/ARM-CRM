-- Replicación declarativa de la arquitectura ARM multicanal, aplicada en Supabase PC020.
-- Ejecutar solo en un entorno CRM previamente preparado y revisar restricciones antes.
create table if not exists public.arm_threads (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
 contact_id uuid not null,
 channel text not null check(channel in ('whatsapp','instagram','facebook','web')),
 external_account_ref text not null,
 external_sender_id text not null,
 status text not null default 'pending' check(status in ('pending','human','bot','closed')),
 assigned_to uuid references auth.users(id),
 last_activity_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(workspace_id,id),
 unique(workspace_id,channel,external_account_ref,external_sender_id),
 foreign key(workspace_id,contact_id) references public.arm_contacts(workspace_id,id)
);
alter table public.arm_messages add column if not exists thread_id uuid;
alter table public.arm_messages add column if not exists message_type text not null default 'text';
create index if not exists arm_threads_workspace_recent on public.arm_threads(workspace_id,last_activity_at desc);
create index if not exists arm_messages_thread_time on public.arm_messages(workspace_id,thread_id,created_at);
alter table public.arm_threads enable row level security;
create policy arm_threads_select on public.arm_threads for select to authenticated
 using(workspace_id in (select id from public.arm_workspaces));
create policy arm_threads_update on public.arm_threads for update to authenticated
 using(workspace_id in (select id from public.arm_workspaces where owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))
 with check(workspace_id in (select id from public.arm_workspaces where owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id and m.user_id=(select auth.uid()) and m.role in ('admin','seller')));
create table if not exists public.arm_channel_accounts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
 channel text not null check(channel in ('whatsapp','instagram','facebook')),
 provider text not null default 'composio' check(provider='composio'),
 auth_config_id text not null,
 connected_account_id text not null,
 alias text,
 auth_status text not null check(auth_status in ('ACTIVE','FAILED','EXPIRED','INITIALIZING','INITIATED','INACTIVE','REVOKED','UNKNOWN')),
 write_enabled boolean not null default false,
 last_checked_at timestamptz not null default now(),
 unique(workspace_id,provider,connected_account_id)
);
alter table public.arm_channel_accounts enable row level security;
create policy arm_channel_accounts_read on public.arm_channel_accounts for select to authenticated
 using(workspace_id in (select id from public.arm_workspaces));
-- Least privilege; never let browser TRUNCATE tables bypassing RLS.
revoke all privileges on table public.arm_threads,public.arm_channel_accounts,public.arm_messages,
 public.arm_inbound_events,public.arm_contacts,public.arm_deals,public.arm_followups,
 public.arm_products,public.arm_workspaces,public.arm_memberships,public.arm_ai_usage,
 public.arm_channel_connections from anon,authenticated;
grant select on public.arm_threads,public.arm_channel_accounts,public.arm_messages,
 public.arm_contacts,public.arm_deals,public.arm_followups,public.arm_products,
 public.arm_workspaces,public.arm_memberships,public.arm_ai_usage,
 public.arm_channel_connections to authenticated;
grant insert,update on public.arm_contacts,public.arm_deals,public.arm_followups,public.arm_workspaces to authenticated;
grant insert,update,delete on public.arm_memberships to authenticated;
grant update(status) on public.arm_threads to authenticated;
