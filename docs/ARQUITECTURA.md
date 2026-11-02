# Arquitectura actual — STECH ARM-CRM

## Activo en PC020
- Frontend Vite + React + TypeScript (ruta `C:\DESAROLLO\ARM-CRM`), interfaz modular y responsive STECH.
- Supabase activo temporalmente: `iipamvqbipbolchlozoj` para reutilizar Google Auth existente y permitir CRM funcional inmediatamente.
- Tablas exclusivas `public.arm_*`, protegidas con RLS, sin alterar tablas del antiguo CRM.
- Workspace real `STECH PERU` perteneciente al administrador autenticado.
- Catálogo inicial importado: cuatro Ulefone del catálogo anterior; stock/precios NULL mientras ERP no valide.
- Contactos reales con nombre, correo, teléfono, interés, origen; oportunidades con etapas Kanban; seguimientos agendados y completados.
- Módulos `src/features/*`: auth, crm, dashboard, contacts, pipeline, catalog, inbox, agent, integrations.
- No existe modo demo, ni datos simulados importados.

## Separación segura
- Frontend usa SOLO Supabase publishable key. `.env.local` ignorado por Git.
- Ningún token de Composio/Meta/Google Client Secret, SQL Server ni LLM se expone en navegador.
- Políticas RLS protegen workspace y entidades comerciales; solo correos activos previamente admitidos.
- Operaciones que necesitan service_role, Meta o ERP irán a backend privado/Edge Functions con autorización por JWT y logs de auditoría.
- Webhooks Meta: validación de firma, deduplicación por proveedor/ID y registro de consentimiento.
- HERMES se conserva independiente como módulo de marketing sin activar escritura.
- n8n solo procesos orquestados y programados; no duplicar envíos entre conectores.

## Pendiente de integrar
1. Prueba de callback Google con cuenta real de STECH.
2. Sync ERP DB_ST read-only de PN, precio, stock y atributos.
3. Agente LLM real con herramientas, memoria autorizada y catálogo verificado.
4. Conectores oficiales WhatsApp/Instagram/Facebook por Composio o Graph API, con aprobación humana para el primer envío.
5. Migración coordinada al nuevo Supabase cuando Google Auth esté listo allí.

## Evidencia técnica
- `npm run typecheck`, `npm test`, `npm run build` y smoke Playwright ejecutados en PC020.
- Pruebas SQL RLS transaccionales, sin persistir datos de prueba.
- Se mantiene una PR en borrador; no se fusiona sin pruebas de sesión real.
