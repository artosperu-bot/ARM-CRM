-- STECH ARM-CRM / esquema de propuesta para un PROYECTO NUEVO.
-- NO APLICADO AUTOMATICAMENTE. Revisar en staging antes de producción.
create extension if not exists pgcrypto;

create table if not exists public.arm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.arm_memberships (
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'seller' check (role in ('owner', 'admin', 'seller', 'viewer')),
  primary key(workspace_id, user_id)
);
create table if not exists public.arm_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 200),
  phone text,
  email text,
  source text not null default 'web' check (source in ('web', 'whatsapp', 'facebook', 'instagram', 'manual')),
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.arm_deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  contact_id uuid not null references public.arm_contacts(id),
  title text not null,
  stage text not null default 'nuevo' check (stage in ('nuevo','interesado','cotizado','negociacion','ganado','perdido')),
  amount_pen numeric(12,2) check (amount_pen is null or amount_pen >= 0),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.arm_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  partnumber text not null,
  brand text not null,
  title text not null,
  attributes jsonb not null default '{}'::jsonb,
  stock_erp integer,
  price_pen numeric(12,2),
  verified_at timestamptz,
  unique(workspace_id, partnumber),
  check(stock_erp is null or stock_erp >= 0),
  check(price_pen is null or price_pen >= 0)
);
create table if not exists public.arm_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  contact_id uuid not null references public.arm_contacts(id),
  provider text not null check(provider in ('whatsapp','instagram','facebook','web')),
  external_message_id text,
  direction text not null check(direction in ('inbound','outbound')),
  content text,
  created_at timestamptz not null default now(),
  unique(workspace_id, provider, external_message_id)
);
create table if not exists public.arm_followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  contact_id uuid not null references public.arm_contacts(id),
  deal_id uuid references public.arm_deals(id),
  due_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','completed','cancelled')),
  description text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.arm_inbound_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.arm_workspaces(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(workspace_id, provider, external_event_id)
);

alter table public.arm_workspaces enable row level security;
alter table public.arm_memberships enable row level security;
alter table public.arm_contacts enable row level security;
alter table public.arm_deals enable row level security;
alter table public.arm_products enable row level security;
alter table public.arm_messages enable row level security;
alter table public.arm_followups enable row level security;
alter table public.arm_inbound_events enable row level security;

create policy arm_ws_select on public.arm_workspaces for select to authenticated
 using (owner_id = (select auth.uid()) or exists (
  select 1 from public.arm_memberships m where m.workspace_id = id and m.user_id = (select auth.uid())
 ));
create policy arm_ws_insert on public.arm_workspaces for insert to authenticated
 with check (owner_id = (select auth.uid()));
create policy arm_ws_update on public.arm_workspaces for update to authenticated
 using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- Selección acotada a la membresía propia para evitar referencias RLS circulares.
-- Los administradores consultarán miembros mediante endpoints autorizados de backend.
create policy arm_member_select on public.arm_memberships for select to authenticated
 using (user_id = (select auth.uid()));
create policy arm_member_insert on public.arm_memberships for insert to authenticated
 with check (exists (
  select 1 from public.arm_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())
 ));
create policy arm_member_update on public.arm_memberships for update to authenticated
 using (exists (select 1 from public.arm_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())))
 with check (exists (select 1 from public.arm_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy arm_member_delete on public.arm_memberships for delete to authenticated
 using (exists (select 1 from public.arm_workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

-- La membresía restringe las filas; 'authenticated' por sí solo NO autoriza datos.
create policy arm_contacts_select on public.arm_contacts for select to authenticated using (
 exists(select 1 from public.arm_workspaces w where w.id = workspace_id and
 (w.owner_id = (select auth.uid()) or exists(
 select 1 from public.arm_memberships m where m.workspace_id = w.id and m.user_id = (select auth.uid())
 ))));
create policy arm_contacts_insert on public.arm_contacts for insert to authenticated with check (
 exists(select 1 from public.arm_workspaces w where w.id = workspace_id and
 (w.owner_id = (select auth.uid()) or exists(
 select 1 from public.arm_memberships m where m.workspace_id = w.id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','seller')
 ))));
create policy arm_contacts_update on public.arm_contacts for update to authenticated
 using (exists(select 1 from public.arm_workspaces w where w.id = workspace_id and
 (w.owner_id = (select auth.uid()) or exists(select 1 from public.arm_memberships m where m.workspace_id = w.id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','seller')))))
 with check (exists(select 1 from public.arm_workspaces w where w.id = workspace_id and
 (w.owner_id = (select auth.uid()) or exists(select 1 from public.arm_memberships m where m.workspace_id = w.id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','seller')))));

-- La siguiente fase completará policies para deals, products, messages y followups.
-- Intencionalmente no tienen permisos de cliente; denegación por defecto.
-- arm_inbound_events: únicamente backend con permisos especiales, nunca desde navegador.
