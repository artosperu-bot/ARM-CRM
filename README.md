# STECH ARM-CRM

CRM/ARM comercial de STECH PERU. React 19 + TypeScript + Vite 8 + Supabase.

## Estado actual (02/11/2026)
- Interfaz moderna y responsive; dashboard, pipeline Kanban, clientes, agenda de seguimientos, catálogo, inbox y laboratorio de borradores.
- **Datos reales**: Supabase `stech-crm-ai-v2`, tablas con RLS por workspace; CRUD de clientes, oportunidades y seguimientos.
- **Login**: solo Google y correos activos autorizados en `crm_usuarios`. Sin registro público ni demo anónima.
- Correo ADMIN recuperado del sistema anterior: `artosperu@gmail.com`.
- El proveedor Google del **nuevo proyecto Supabase está deshabilitado**; la función de restricción de nuevos usuarios ya está creada pero necesita activarse en Authentication → Hooks. El login de extremo a extremo queda pendiente hasta completar esa configuración.
- **Aún no activado**: envío WhatsApp/Instagram/Facebook, agente LLM real, sincronización ERP/stock.

## PC020
```powershell
cd C:\DESAROLLO\ARM-CRM
npm ci
npm run dev -- --port 5175
```
URL local: http://127.0.0.1:5175/

Configuración local: `.env.local` (ignorado por Git) con solamente URL pública y Supabase publishable key. **Nunca subir service_role ni tokens privados.**

## Verificación
```powershell
npm run typecheck
npm test
npm run build
```

## Documentación
- `docs/ACCESO-INTERNO.md`: recuperar login Google, correos autorizados, RLS y configuración Auth pendiente.
- `docs/ARQUITECTURA.md`: componentes y responsabilidades.
- `docs/INTEGRACIONES-SOCIALES.md`: Composio, Meta, HERMES y ruta segura.
- `supabase/migrations`: migraciones registradas y aplicadas al proyecto nuevo.

Los cambios se mantienen en una rama de revisión; no se ha alterado el CRM anterior, el ERP ni HERMES.
