# Integraciones y observabilidad ARM-CRM — 02/11/2026

## Consumo de IA (datos reales, no demos)
- Origen histórico: `public.ia_metricas_tokens` del CRM anterior, importado a `public.arm_ai_usage` de STECH.
- 528 eventos, 90 sesiones, 651832 tokens entrada, 73627 tokens salida y 109056 tokens cacheados. Historial del 24/08/2026 al 01/09/2026.
- Los tokens cacheados son parte de entrada; NO sumar nuevamente.
- Se muestran filtros por modelo, conversación, fecha y desglose por nodo.
- El CRM anterior no conservó costos facturados en estas 528 métricas: se marca `No registrado`, nunca `USD 0`.
- Los eventos del agente ARM futuro se almacenarán con source=`arm_agent`, modelo, identificador de sesión, costos verificados y proveedor. La pantalla separa métricas reales de estimación.
- Función Supabase `arm-sync-usage` desplegada con `verify_jwt=true`. Botón `Sincronizar historial` solo ADMIN: consulta lectura de fuente existente, hace UPSERT idempotente en `arm_ai_usage`, jamás modifica tablas antiguas.
- Prueba negativa sin JWT de la función: HTTP 401 confirmado.

## Redes / Composio
- `arm_channel_connections` registra estado (solo lectura para usuarios), proveedor y permiso de escritura bloqueado por defecto.
- Se iniciaron flujos de autorización para WhatsApp Business, Instagram Business y Facebook Pages. Al 02/11/2026 no hay conexión ACTIVE confirmada.
- Los enlaces Composio de autorización son efímeros y NO deben persistirse en Git.
- Luego de autorizar, verificar vía Composio lista de cuentas conectadas, ID de página y scopes; jamás suponer autorización.
- El conector HERMES existente publica solo con aprobación expresa y control de autorización. NO habilitar envío automático ni doble dueño de webhooks.
- Estado `not_connected` es correcto hasta validar cuentas. No engañar con estado activo.

## Diseño
- Paleta #7DDCFF celeste, azul marino profundo, superficies claras, tablero de tokens en contraste alto y vista adaptable.
- Menú nuevo `Consumo IA`; los KPIs leen datos reales protegidos por RLS.
- Pendientes: LLM agente en vivo, costos por proveedor, inbox conectada, webhooks oficiales Meta, ERP stock/precios.
