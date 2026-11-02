# ARM-CRM | Canales Meta / Composio

Actualizado el 02/11/2026. **Sin envíos automáticos.**

## Proyecto real de Composio identificado en el navegador autorizado
Proyecto: `artosperu_workspace_first_project`

| Canal | Auth Config ID | Configuración |
| --- | --- | --- |
| WhatsApp Business | `ac_CBs5uIOC0LuD` | Enabled; el panel muestra 2 conexiones |
| Facebook Pages | `ac_WyKgzw8NEaji` | Enabled; el panel muestra 1 conexión |
| Instagram Business | `ac_eSPuwK-LxqE4` | Enabled; el panel muestra 2 conexiones |

**Atención:** el contador «Connections» no confirma que esas cuentas estén `ACTIVE`, ni qué permisos otorgaron. La sesión Composio MCP del asistente es diferente y no puede verificar estas conexiones; sus Auth Configs no se deben recrear ni borrar.

## Verificación real del 02/11/2026 — completada
- `COMPOSIO_API_KEY` quedó configurada como secreto en Supabase (no se expuso el valor).
- Comprobación autenticada ejecutada desde ARM-CRM con el usuario ADMIN. Confirmada respuesta correcta de la API v3.1 de Composio; el panel mostró «Composio verificado: 3 conexiones OAuth activas detectadas».
- WhatsApp: **1 ACTIVE**, **1 EXPIRED**.
- Facebook: **1 ACTIVE**, **0 EXPIRED**.
- Instagram: **1 ACTIVE**, **1 EXPIRED**.
- Los tres canales se registraron en `arm_channel_connections` como `read_only` y `write_enabled=false`, revisados a las 11:24 hora de Lima (16:24 UTC).
- Las 2 conexiones EXPIRED se conservaron sin renovar ni eliminar; no deben confundirse con las ACTIVE.
- Este resultado demuestra autenticación OAuth activa, **no prueba recepción de DMs/WhatsApp ni permiso de publicación**. Mantener el receptor Meta a la espera de secretos y subscripciones verificadas.

## Lo realizado
- Pantalla multicanal real `src/features/inbox`: filtros, contactos, conversación, estado pendiente/humano/cerrada. Búsquedas desde `arm_threads` y `arm_messages`.
- Nuevas tablas `arm_threads` y `arm_channel_accounts` con RLS y sin datos de prueba; mensajes enriquecidos con `thread_id`.
- No hay permiso de `INSERT` sobre mensajes desde navegador. Se revocó `TRUNCATE` a roles frontend en tablas ARM.
- `arm-meta-webhook` es receptor opcional **directo de Meta**: GET challenge + POST `X-Hub-Signature-256`, parser WhatsApp/Messenger/Instagram, validación de cuentas asociadas a workspace y deduplicación por mensaje. `verify_jwt=false` porque Meta envía HMAC, no JWT; sin secretos devuelve 503. Confirmado GET=503 sin credenciales.
- `arm-composio-status` es un verificador **de solo lectura** (JWT Google y ADMIN). Consulta `GET https://backend.composio.dev/api/v3.1/connected_accounts`, filtra por Auth Config ID, registra cuentas en `arm_channel_accounts` y mantiene `write_enabled=false`. Confirmado que POST sin JWT devuelve 401.
- El proyecto Supabase operativo es el antiguo STECH `iipamvqbipbolchlozoj`; su catálogo y autenticación permanecen intactos.
- Pruebas SQL de lectura de mensajes y cambio de estado con usuario autorizado ejecutadas con `ROLLBACK`.

## Próximos pasos de integración
1. La API key de Composio **ya está configurada y verificada** en Supabase, sin exponer secretos.
2. Las cuentas OAuth ACTIVE están verificadas. Revisar correspondencia de WABA, Page ID e Instagram profesional antes de elegir el canal emisor.
3. Habilitar recepción de eventos mediante conectores autorizados y probar con cuenta de pruebas (sin envíos masivos).
4. Elegir **un solo origen de ingesta por canal**: webhooks Meta directos O triggers Composio con autenticación y deduplicación. Nunca ambos escribiendo sin coordinar.

## Para activar recepción directa Meta (si se selecciona ese camino)
- Endpoint: `https://iipamvqbipbolchlozoj.supabase.co/functions/v1/arm-meta-webhook`.
- Registrar como secretos de Supabase `ARM_META_VERIFY_TOKEN` y `ARM_META_APP_SECRET` (del app Meta correspondiente); nunca en VITE o GitHub.
- En Meta Developers configurar Webhooks con el callback, el mismo verify token y las suscripciones autorizadas.
- Asociar el identificador oficial (WhatsApp `metadata.phone_number_id`, Facebook Page ID o Instagram profesional ID) a `arm_channel_connections` bajo `provider='meta_graph'`, `external_account_ref` correspondiente y `status='read_only'` solo después de verificar la titularidad.
- `write_enabled=false` en todas las conexiones. Activar respuestas solo tras validar ventana de mensajería, consentimiento, plantillas, human handoff y auditoría.

### Verificación
- Edge webhook sin secreto GET 503, comprobado: no acepta cuentas no verificadas.
- Verificador Composio sin JWT POST 401, comprobado.
- Los secretos de Composio y Meta no fueron solicitados ni copiados al repositorio.
