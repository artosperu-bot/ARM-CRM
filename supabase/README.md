# Supabase — propuesta NO aplicada

El archivo schema.sql propone un esquema aislado multiusuario/multitenant con RLS.
No ejecutar contra el proyecto previo sin auditar tablas, policies, duplicados y roles.
No se ha conectado ni cambiado ningún proyecto Supabase.

En un proyecto NUEVO, probar primero en entorno aislado, revisar permisos y políticas, luego generar una migración usando Supabase CLI (verificar `supabase migration new --help`). Este archivo es el diseño de partida, no una migración activa.

**Importante:** el frontend actual está en DEMO y NO utiliza este esquema. Para habilitar modo real faltan autenticación, API de datos, y pruebas de seguridad.
