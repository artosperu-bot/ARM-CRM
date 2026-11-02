# STECH ARM-CRM

**Estado:** prototipo funcional DEMO en rama de desarrollo. Sin integraciones reales ni datos de clientes.

Sistema de gestión comercial inteligente para STECH PERU, con pipeline Kanban, directorio, inbox, catálogo y laboratorio de agente seguro.

## Ejecutar en PC020

\`\`\`powershell
cd C:\\DESAROLLO\\ARM-CRM
npm install
npm run dev
\`\`\`

Navegador: http://127.0.0.1:5173

## Validar

\`\`\`powershell
npm run typecheck
npm test
npm run build
\`\`\`

El CRM actualmente funciona con fixtures y modificaciones de demostración que se pierden al recargar. **No** está conectado a Supabase ni Meta, así que no es un CRM productivo todavía.

## Integraciones futuras

- **Supabase:** auth, entidades comerciales, RLS y conocimiento verificado; propuesta `supabase/schema.sql` (NO aplicada).
- **ERP DB_ST:** backend de solo lectura, sincronización por PN.
- **WhatsApp Business:** Meta Cloud API y webhooks oficiales.
- **Facebook/Instagram:** Composio para acciones autorizadas y recepción idempotente.
- **HERMES:** reutilizar la orquestación de marketing existente con aprobaciones.
- **n8n:** workflows de seguimiento; no duplica el inbox ni las escrituras de Meta.
- **DeskcommCRM:** arquitectura open source MIT analizada como referencia; el código externo **no** fue importado sin auditoría.

Consulta `docs/ARQUITECTURA.md`, `docs/INTEGRACIONES-SOCIALES.md`, `docs/CRM-ANTERIOR.md`.

## Seguridad

No subir `.env`, claves de Meta, OpenAI, Composio, Supabase service_role, credenciales SQL, historiales de clientes ni copias de la app anterior.
Todo envío o publicación real requiere comprobación de permisos, auditoría y aprobación.
