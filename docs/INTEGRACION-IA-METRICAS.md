# ARM-CRM — limpieza de datos históricos y conexión WhatsApp

## Limpieza solicitada el 02/11/2026
- Se eliminaron **528** filas con `source='legacy_ia_metricas_tokens'` de `public.arm_ai_usage`, limitadas al workspace STECH PERU del administrador.
- Verificación posterior: `arm_ai_usage=0`, `arm_messages=0`, `arm_inbound_events=0`, `arm_contacts=0`. Se conservaron los **4 productos** verificados como registros reales de catálogo.
- Los registros de `public.ia_metricas_tokens` del **CRM anterior (528 filas)** permanecen intactos; no se alteran sistemas compartidos ni se eliminan sus historiales.
- Función remota `arm-sync-usage` reemplazada por respuesta **HTTP 410** y `verify_jwt=true`: ya no importa historiales.
- Quitado el botón `Sincronizar historial` de la UI y filtrada la consulta de consumo por `source='arm_agent'`: solamente métricas nuevas, sin datasets históricos.
- Prohibido reimportar eventos de ese origen sin instrucción nueva y explícita.

## WhatsApp/Composio
- Estado confirmado con herramienta Composio: **0** conexiones ACTIVE para WhatsApp, Instagram y Facebook; tres autorizaciones iniciadas que requieren acción del propietario.
- Captura del usuario: Composio → Auth Configs → WhatsApp → Create Auth Config. Las selecciones OAuth 2.0 y Composio Managed son correctas para iniciar sin credenciales OAuth propias.
- Crear Auth Config **no** conecta la cuenta ni el CRM automáticamente; después es necesario Connect Account (prueba de Playground) o un Connect Link destinado al usuario de ARM-CRM.
- Primero confirmar permisos comerciales mínimos y una cuenta **WhatsApp Business** con WABA. Jamás utilizar WhatsApp Personal como API empresarial.
- No conservar links de autorización ni secretos en Git.
- Antes de marcar `arm_channel_connections.status='active'`, verificar realmente la conexión por Composio y la autenticación de la cuenta Meta.
- No habilitar `write_enabled` ni envío/publicaciones mientras no estén probados webhooks, validación de firma, deduplicación y permisos.

## Métricas futuras
- `arm_ai_usage` permanece como tabla para **eventos nuevos** generados por el agente ARM-CRM; coste USD = NULL salvo dato medido por proveedor o estimación identificada.
- El panel Consumo IA empieza en cero hasta que un proveedor LLM real registre llamadas; no generar muestras ficticias para simular uso.
