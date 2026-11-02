# Acceso interno STECH — Google + Supabase

## Decisión del proyecto
- **Sin registro público**, sin formulario de email/contraseña ni acceso demo anónimo.
- Ingreso: **Continuar con Google**.
- La sesión de Google **NO otorga acceso por sí sola**. El correo debe estar activo en `public.crm_usuarios`.
- Roles reconocidos: `ADMIN` y `ASESOR`.
- `ADMIN` puede crear el espacio comercial; `ASESOR` necesita membresía de un administrador.
- Los datos de CRM tienen RLS y el acceso a workspaces depende de la lista activa. Un usuario no autorizado no puede consultar el CRM.

## Evidencia recuperada del CRM anterior
- `C:\DESAROLLO\crm-frontend\src\features\auth\LoginPage.tsx`: Google OAuth, sin registro público.
- `AuthProvider.tsx`: validación de `crm_usuarios`, `activo`, `rol`.
- En el proyecto Supabase antiguo había **una sola cuenta activa**: `artosperu@gmail.com`, rol `ADMIN`. Se transfirió solo esa autorización a `stech-crm-ai-v2`.
- No inventar ni añadir otros correos. Se habilitan únicamente desde backend privilegiado y con decisión administrativa.

## Base de datos aplicada
- `supabase/migrations/20261102_crm_google_access_allowlist.sql`: tabla `crm_usuarios` y políticas de workspace.
- `supabase/migrations/20261102_auth_hook_allow_google.sql`: función `crm_private.allow_google_stech_users(jsonb)`.
- La función se verificó con tres escenarios: cuenta activa Google permitida, cuenta ajena denegada, mismo correo usando otro proveedor denegado.
- **La función de Auth Hook está creada pero aún NO vinculada/activada en Supabase Auth.** Hasta que esté activa, el CRM y su base de datos bloquean cuentas externas, pero Supabase Auth podría crear una identidad para ellas si la configuración global lo permite. No confundir ambas protecciones.

## Configuración pendiente (Supabase stech-crm-ai-v2)
**Detectado por lectura de Auth settings**: `external.google=false` y `disable_signup=false`.

Para que el acceso Google funcione de extremo a extremo:
1. En el proyecto `rxewmgnndzacthnhdxjx`, ir a **Authentication → Sign In / Providers → Google** y habilitarlo con un cliente OAuth propio. El cliente debe estar configurado de manera segura en Google Cloud. El callback de Supabase es `https://rxewmgnndzacthnhdxjx.supabase.co/auth/v1/callback`.
2. En **Authentication → URL Configuration**, permitir `http://127.0.0.1:5175` para desarrollo local; agregar URLs de producción solo cuando se despliegue.
3. **Antes de habilitar acceso general**, ir a **Authentication → Hooks → Before User Created**, escoger la función Postgres `crm_private.allow_google_stech_users` y activarla. Esto impide la creación de identidades no autorizadas.
4. Comprobar con cuenta autorizada: redirección Google, `crm_usuarios` activo, creación de workspace admin. Comprobar con cuenta ajena: rechazo en Auth y acceso nulo al CRM.
5. Proteger secretos Google OAuth en Supabase/Google Cloud; nunca usar variables `VITE_` para un client secret.

No hay credenciales Google OAuth en `.env.local`. No se requiere ni debe copiar el `.env` de HERMES.
No modificar el proyecto Supabase antiguo `iipamvqbipbolchlozoj`.

## URLs y referencias
- https://supabase.com/dashboard/project/rxewmgnndzacthnhdxjx
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
