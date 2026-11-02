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

## Lo realizado
- Pantalla multicanal real `src/features/inbox`: filtros, contactos, conversación, estado pendiente/humano/cerrada. Búsquedas desde `arm_threads` y `arm_messages`.
- Nuevas tablas `arm_threads` y `arm_channel_accounts` con RLS y sin datos de prueba; mensajes enriquecidos con `thread_id`.
- No hay permiso de `INSERT` sobre mensajes desde navegador. Se revocó `TRUNCATE` a roles frontend en tablas ARM.
- `arm-meta-webhook` es receptor opcional **directo de Meta**: GET challenge + POST `X-Hub-Signature-256`, parser WhatsApp/Messenger/Instagram, validación de cuentas asociadas a workspace y deduplicación por mensaje. `verify_jwt=false` porque Meta envía HMAC, no JWT; sin secretos devuelve 503. Confirmado GET=503 sin credenciales.
- `arm-composio-status` es un verificador **de solo lectura** (JWT Google y ADMIN). Consulta `GET https://backend.composio.dev/api/v3.1/connected_accounts`, filtra por Auth Config ID, registra cuentas en `arm_channel_accounts` y mantiene `write_enabled=false`. Confirmado que POST sin JWT devuelve 401.
- El proyecto Supabase operativo es el antiguo STECH `iipamvqbipbolchlozoj`; su catálogo y autenticación permanecen intactos.
- Pruebas SQL de lectura de mensajes y cambio de estado con usuario autorizado ejecutadas con `ROLLBACK`.

## Paso de conexión pendiente (NO introducir claves en chat)
1. Crear o utilizar una API key **del proyecto de Composio `artosperu_workspace_first_project`** desde su menú **API Keys**. No confundirla con el Auth Config ID.
2. Guardar `COMPOSIO_API_KEY` solo en Supabase → proyecto `iipamvqbipbolchlozoj` → Edge Functions → Secrets.
3. En ARM-CRM → Integraciones → **Verificar en Composio**, iniciar sesión Google como ADMIN y ejecutar la comprobación. El servidor marcará `read_only` si encuentra una cuenta `ACTIVE`, nunca `active` con envío habilitado.
4. Validar que cada cuenta `ACTIVE` corresponda a la página, Instagram profesional y WABA correcta antes de asociar identificadores de mensaje.
5. Elegir **un solo origen de ingesta por canal**: webhooks Meta directos O triggers Composio con autenticación y deduplicación. Nunca ambos escribiendo sin coordinar.

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
