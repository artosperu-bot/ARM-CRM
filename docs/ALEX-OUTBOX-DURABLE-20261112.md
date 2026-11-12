# ALEX — WhatsApp outbox duradero (12/11/2026)

## Qué cambió
- Una fila de trabajo `arm_whatsapp_outbox` se crea **en la misma transacción** que inserta cada mensaje entrante de WhatsApp válido; si la escritura falla, no se confirma la ingestión.
- El gateway ya no despacha Graph desde `queueMicrotask`; un trabajador en PC020 lee la cola mediante `arm_claim_whatsapp_outbox` con `FOR UPDATE SKIP LOCKED`.
- Transiciones: `pending → triaging → ready → sending → sent`, o `skipped` / `review`. Los estados `triaging` antiguos pueden reintentarse como máximo tres veces; `sending` antiguo se marca `review` sin reenvío por el riesgo de aceptación sin confirmación de Meta.
- Cada etapa vuelve a validar el ID del número de prueba, la lista de destinatarios autorizados y la frescura del mensaje.
- Solicitudes de persona y posventa se procesan primero como atención humana; no se generan respuestas comerciales si un asesor tomó el hilo.
- Los webhooks firmados de confirmación de Meta actualizan `delivery_status` de mensajes cuyo ID está registrado, sin degradar `read → delivered → sent`.
- No se programan campañas, seguimientos ni mensajes a clientes reales. Las fotografías siguen requiriendo fuente y SKU verificados.

## Limitaciones intencionales
- `sent` indica aceptación por la API Graph, **no entrega al teléfono**. Solo un webhook posterior firmado permite `delivered` o `read`.
- Una caída entre aceptación de Meta y escritura de `sent` deja `review`: el operador debe conciliar el `provider_message_id` antes de cualquier intervención. No hay promesa falsa de exactamente una entrega.
- El gateway solo atiende los dos teléfonos de sandbox ya configurados. No se amplían canales.
- Aún falta una vista de operación que muestre los trabajos en `review`, y pruebas reales de recepción de foto, entregas y cambios de ventana.
- No se modificó el ERP ni su SQL Server.

## Verificación
- Pruebas unitarias de allowlist, triage, exclusión de opt-out, no repetición del Graph ambiguo y recuperación de fallas.
- Pruebas de parseo y persistencia del estado Meta firmado, con filtro de cuenta.
- Confirmar `/health` del gateway: `durableOutbox=true` en el inicio y `deliveryReceiptsPersisted=true`.
- Comprobar con SQL el disparador, la función RPC, el control de permisos y los conteos por estado.
- Probar inserción y claim en una transacción con `ROLLBACK` para no producir salidas a Graph ni mensajes permanentes.
