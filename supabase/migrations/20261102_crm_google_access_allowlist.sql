-- ARM-CRM: restaurar control de acceso STECH basado en CRM anterior.
-- Migración no destructiva para stech-crm-ai-v2.
-- Solo se incorpora la cuenta ADMIN activa comprobada en el CRM anterior.
create table if not exists public.crm_usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  nombre text,
  rol text not null default 'ASESOR' check (rol in ('ADMIN','ASESOR')),
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crm_usuarios enable row level security;
grant select on public.crm_usuarios to authenticated;
-- La lista se administra solo desde entorno privilegiado; no hay políticas públicas de escritura.
create policy crm_usuario_puede_ver_su_perfil on public.crm_usuarios
  for select to authenticated
  using (activo = true and email = lower(coalesce((select auth.jwt()->>'email'), '')));

insert into public.crm_usuarios (email,nombre,rol,activo)
values ('artosperu@gmail.com','Administrador STECH','ADMIN',true)
on conflict (email) do nothing;

-- Restringe el acceso a un workspace incluso si alguien se autenticara vía OAuth.
alter policy arm_workspaces_select on public.arm_workspaces to authenticated using (
  exists (select 1 from public.crm_usuarios u
          where u.email = lower(coalesce((select auth.jwt()->>'email'), '')) and u.activo)
  and (
    owner_id = (select auth.uid())
    or exists (select 1 from public.arm_memberships m
               where m.workspace_id=id and m.user_id=(select auth.uid()))
  )
);
-- Solo un correo aprobado y ADMIN puede crear un nuevo espacio comercial.
alter policy arm_workspaces_insert on public.arm_workspaces to authenticated with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.crm_usuarios u
              where u.email = lower(coalesce((select auth.jwt()->>'email'), ''))
                and u.activo and u.rol = 'ADMIN')
);
alter policy arm_workspaces_update on public.arm_workspaces to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.crm_usuarios u
                where u.email = lower(coalesce((select auth.jwt()->>'email'), ''))
                  and u.activo and u.rol='ADMIN')
  )
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.crm_usuarios u
                where u.email = lower(coalesce((select auth.jwt()->>'email'), ''))
                  and u.activo and u.rol='ADMIN')
  );

-- Los usuarios desactivados dejan de leer sus membresías.
alter policy arm_memberships_read_self on public.arm_memberships to authenticated using (
  user_id = (select auth.uid())
  and exists (select 1 from public.crm_usuarios u
              where u.email = lower(coalesce((select auth.jwt()->>'email'), ''))
                and u.activo)
);
-- Los datos comerciales ya dependen de arm_workspaces por sus políticas RLS,
-- por lo que una cuenta no autorizada no puede consultarlos ni escribirlos.
