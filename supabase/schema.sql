-- ARM-CRM / primera migración no destructiva (stech-crm-ai-v2)
-- Sin datos precargados y sin exposición de credenciales.
create extension if not exists pgcrypto;

create table public.arm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.arm_memberships (
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','seller','viewer')),
  primary key(workspace_id,user_id)
);
create table public.arm_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  display_name text not null check(char_length(trim(display_name)) between 2 and 200),
  phone text,
  email text,
  source text not null default 'manual' check(source in ('manual','whatsapp','instagram','facebook','web')),
  notes text,
  created_at timestamptz not null default now(),
  unique (workspace_id,id)
);
create index arm_contacts_workspace_created on public.arm_contacts(workspace_id,created_at desc);
create table public.arm_deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  contact_id uuid not null,
  title text not null check(char_length(trim(title)) between 2 and 200),
  stage text not null default 'nuevo' check(stage in ('nuevo','interesado','cotizado','negociacion','ganado','perdido')),
  amount_pen numeric(12,2) check(amount_pen is null or amount_pen >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(workspace_id,contact_id) references public.arm_contacts(workspace_id,id)
);
create index arm_deals_workspace_stage on public.arm_deals(workspace_id,stage);
create table public.arm_followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  contact_id uuid not null,
  deal_id uuid references public.arm_deals(id),
  due_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','completed','cancelled')),
  description text not null,
  created_at timestamptz not null default now(),
  foreign key(workspace_id,contact_id) references public.arm_contacts(workspace_id,id)
);
create index arm_followups_due on public.arm_followups(workspace_id,status,due_at);
create table public.arm_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  partnumber text not null,
  brand text not null,
  title text not null,
  attributes jsonb not null default '{}'::jsonb,
  stock_erp integer check(stock_erp is null or stock_erp>=0),
  price_pen numeric(12,2) check(price_pen is null or price_pen>=0),
  verified_at timestamptz,
  unique(workspace_id,partnumber)
);
create table public.arm_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  contact_id uuid not null,
  provider text not null check(provider in ('whatsapp','instagram','facebook','web')),
  external_message_id text,
  direction text not null check(direction in ('inbound','outbound')),
  content text,
  created_at timestamptz not null default now(),
  foreign key(workspace_id,contact_id) references public.arm_contacts(workspace_id,id),
  unique(workspace_id,provider,external_message_id)
);
create index arm_messages_history on public.arm_messages(workspace_id,contact_id,created_at desc);
create table public.arm_inbound_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique(workspace_id,provider,external_event_id)
);

alter table public.arm_workspaces enable row level security;
alter table public.arm_memberships enable row level security;
alter table public.arm_contacts enable row level security;
alter table public.arm_deals enable row level security;
alter table public.arm_followups enable row level security;
alter table public.arm_products enable row level security;
alter table public.arm_messages enable row level security;
alter table public.arm_inbound_events enable row level security;

-- Membresías: cada miembro ve su fila; no subconsulta circular.
create policy arm_memberships_read_self on public.arm_memberships for select to authenticated
 using (user_id = (select auth.uid()));
create policy arm_memberships_owner_insert on public.arm_memberships for insert to authenticated
 with check(exists(select 1 from public.arm_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy arm_memberships_owner_update on public.arm_memberships for update to authenticated
 using(exists(select 1 from public.arm_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.arm_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy arm_memberships_owner_delete on public.arm_memberships for delete to authenticated
 using(exists(select 1 from public.arm_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));

create policy arm_workspaces_select on public.arm_workspaces for select to authenticated
 using(owner_id=(select auth.uid()) or exists(select 1 from public.arm_memberships m
 where m.workspace_id=id and m.user_id=(select auth.uid())));
create policy arm_workspaces_insert on public.arm_workspaces for insert to authenticated
 with check(owner_id=(select auth.uid()));
create policy arm_workspaces_update on public.arm_workspaces for update to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

-- El workspace es visible únicamente si el usuario es propietario o miembro.
create policy arm_contacts_select on public.arm_contacts for select to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w));
create policy arm_contacts_insert on public.arm_contacts for insert to authenticated
 with check(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')));
create policy arm_contacts_update on public.arm_contacts for update to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))
 with check(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')));

create policy arm_deals_select on public.arm_deals for select to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w));
create policy arm_deals_insert on public.arm_deals for insert to authenticated
 with check(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')));
create policy arm_deals_update on public.arm_deals for update to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))
 with check(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')));

create policy arm_followups_select on public.arm_followups for select to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w));
create policy arm_followups_insert on public.arm_followups for insert to authenticated
 with check(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')));
create policy arm_followups_update on public.arm_followups for update to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')))
 with check(workspace_id in (select w.id from public.arm_workspaces w where w.owner_id=(select auth.uid()))
 or exists(select 1 from public.arm_memberships m where m.workspace_id=workspace_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','seller')));

create policy arm_products_select on public.arm_products for select to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w));
create policy arm_messages_select on public.arm_messages for select to authenticated
 using(workspace_id in (select w.id from public.arm_workspaces w));
-- Productos, mensajes y eventos: inserción sólo desde backend seguro (service role).
-- Sin policy INSERT/UPDATE para clientes autenticados en estas tablas.
