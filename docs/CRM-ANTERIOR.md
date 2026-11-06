# Referencias locales — no migradas

Revisión SOLO LECTURA de PC020:
- C:\DESAROLLO\crm-frontend: Vite + React + Supabase, se identificaron módulos dashboard, conversaciones, inbox, automatizaciones, auth, whatsapp y pruebas.
- Incluye .env y .env.example; se leyó únicamente .env.example. El .env contiene información privada y NO se debe abrir/imprimir/subir sin necesidad.
- .env.example publica solo VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY y VITE_STECH_BACKEND_URL. Los valores reales no se han reutilizado ni verificado.
- C:\DESAROLLO\_STAGING\crm-followups-ui-v2-preview: referencia de interfaz en staging, no modificar.
- C:\DESAROLLO\HERMES: funciones Meta, permisos en producción bloqueados y publicaciones orgánicas con aprobación. No modificarlo desde este repo.

La migración de código se decidirá después de comparar dominio de datos, RBAC y contratos. No se importan dependencias ni credenciales a ciegas.
