-- Defensa adicional: Supabase Authentication > Hooks > Before User Created.
-- La función se crea con permisos mínimos, pero DEBE habilitarse en Auth Hooks
-- para impedir que Supabase Auth registre identidades no autorizadas.
create schema if not exists crm_private;
revoke all on schema crm_private from public;
grant usage on schema crm_private to supabase_auth_admin;

create or replace function crm_private.allow_google_stech_users(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_email text := lower(trim(coalesce(event->'user'->>'email','')));
  candidate_provider text := lower(coalesce(event->'user'->'app_metadata'->>'provider',''));
begin
  if candidate_provider = 'google'
     and candidate_email <> ''
     and exists (select 1 from public.crm_usuarios
                 where email = candidate_email and activo = true)
  then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error',jsonb_build_object(
    'http_code',403,'message','Acceso restringido a las cuentas Google autorizadas de STECH.'));
end;
$$;
revoke all on function crm_private.allow_google_stech_users(jsonb) from public, anon, authenticated;
grant execute on function crm_private.allow_google_stech_users(jsonb) to supabase_auth_admin;
