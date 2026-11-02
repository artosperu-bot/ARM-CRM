# STECH ARM-CRM

CRM comercial de STECH PERU con **React 19, TypeScript, Vite 8 y Supabase PostgreSQL**. Interfaz de uso interno, sin registro público y sin datos ficticios.

## Estado actual (02-11-2026)
- Login exclusivo con Google OAuth y lista interna `crm_usuarios` (rol `ADMIN` o `ASESOR`, activo).
- Base de datos real para `arm_workspaces`, `arm_contacts`, `arm_deals`, `arm_followups`, `arm_products`, `arm_messages`, `arm_memberships`, `arm_inbound_events`.
- Protección RLS por espacio de trabajo y verificación de correo autorizado.
- Panel de indicadores reales, pipeline Kanban interactivo, clientes, agenda con vencimientos, catálogo y herramientas de consulta comercial.
- Workspace STECH PERU creado para el administrador autorizado.
- 4 celulares Ulefone importados del catálogo comercial existente; precio y stock sin validar se muestran como **sin verificar**, nunca como cantidades inventadas.
- No hay datos ni acceso de demostración.
- **Agente comercial OpenAI API (solo OpenAI)**: backend local PC020, modelo económico fijo `gpt-5.4-mini`, chat interno supervisado y consumo por conversación. La clave queda únicamente en el servidor. La primera respuesta autenticada completa aún requiere prueba desde la interfaz.
- **Webhooks Meta**: receptor y bandeja preparados, pero sin entrega real confirmada; no se envían mensajes automáticos ni se simulan conversaciones. Precio/stock ERP aún sin integrar.

## Autenticación reutilizada
Para habilitar acceso real inmediatamente sin solicitar credenciales OAuth nuevas, ARM-CRM está configurado en PC020 para usar el **proyecto Supabase anterior** `iipamvqbipbolchlozoj`, que ya tenía Google OAuth funcionando y el usuario administrador de STECH.

La nueva base `stech-crm-ai-v2` (`rxewmgnndzacthnhdxjx`) se mantiene intacta para migración futura, pero **no se usa como backend de la app actual**. En el proyecto antiguo se añadieron exclusivamente nuevas tablas `arm_*` y sus políticas; **ninguna tabla antigua fue eliminada o modificada**.

## Ejecutar en PC020
```powershell
cd C:\DESAROLLO\ARM-CRM
npm ci
npm run dev -- --port 5175
# En otra terminal, iniciar solo el backend privado de OpenAI:
npm run agent
```
Abre `http://127.0.0.1:5175/`, pulsa **Continuar con Google** y utiliza el correo previamente autorizado por STECH.

`.env.local` está ignorado en GitHub y contiene únicamente la URL pública y la llave publishable de Supabase. No se usan service-role ni tokens privados en el frontend.

## Verificar
```powershell
npm run typecheck
npm test
npm run build
```
Se probó en PC020 con Playwright en navegador Chrome aislado: el formulario no expone registro/demos y al pulsar Google redirige a `accounts.google.com`. **Aún falta validar la selección de la cuenta y el retorno OAuth con una sesión interactiva autorizada**.

## Arquitectura
- `src/features/auth`: Google OAuth y control de correo/rol
- `src/features/crm`: repositorios de datos Supabase y agenda
- `src/features/dashboard`: indicadores
- `src/features/contacts`: contactos
- `src/features/pipeline`: embudo Kanban
- `src/features/catalog`: productos
- `src/features/agent`: chat supervisado con OpenAI, conversaciones privadas y consumo real de tokens
- `src/features/inbox`: estado de mensajería, sin datos simulados
- `src/features/integrations`: integraciones y estados
- `supabase/schema.sql`: esquema base, aplicado a ambos proyectos de forma aislada.

## Lo siguiente para integrar
Validar primera conversación de extremo a extremo con OpenAI, mejorar los atributos verificados de celulares, agregar acceso de solo lectura a stock/precios ERP y completar recepción webhooks Meta/Composio. El CRM anterior y HERMES se mantienen sin alteraciones.

Para costos, límites y configuración del agente: `docs/AGENTE-OPENAI.md`. Para seguridad y configuración: `docs/ACCESO-INTERNO.md`, `docs/ARQUITECTURA.md`, `docs/INTEGRACIONES-SOCIALES.md`.
