# Persistencia Supabase STECH ARM-CRM

ARM-CRM usa actualmente el proyecto Supabase original `iipamvqbipbolchlozoj`, donde el proveedor Google OAuth funciona y ya existen usuarios autorizados. 
Se añadieron exclusivamente las tablas `public.arm_*` con RLS, workspace para el administrador y 4 productos Ulefone reales importados por PN, sin precio ni stock inventados.

La estructura `supabase/schema.sql` también fue aplicada previamente al proyecto `stech-crm-ai-v2` que aún no tiene Google OAuth habilitado. No mezclar las claves de ambos proyectos.

No eliminar ni restablecer tablas del proyecto antiguo. Las integraciones pendientes y migración futura se planificarán de forma no destructiva.

No imprimir, almacenar en Git ni exponer service-role, tokens Meta/Google ni credenciales SQL. Solo usar la clave publishable en frontend.
