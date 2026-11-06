# Integración Meta — estado verificado 02/11/2026

## Webhooks ya operativos
Meta Developers devuelve para app `2264991854297489` (Wp_Test_N8N_001) una suscripción activa `whatsapp_business_account` con campo `messages`, callback `https://whatsapp.artos.pe/...`.

**No modificar esta suscripción**: está vinculada a un sistema existente y reemplazarla podría dejarlo sin mensajes. La app `1061627779994399` HERMES_ADS_TEST no registra suscripciones de webhook y la app `2537884529959031` tampoco.

## Cuentas identificadas en Meta
- Página Stechperu: `557869280753496`.
- Página S&T Store: `192566331490414`.
- Instagram profesional asociado a Stechperu: `17841406533346328`.
- Registradas con `inbound_enabled=false` (no hay ingesta de clientes ni copia de historiales).

## Backend implementado
- `public.arm_meta_accounts`: registro de origen y punto de corte `inbound_since`, inicialmente apagado.
- `public.arm_ingest_meta_message`: función de servicio con transacción atómica, bloqueo concurrente por remitente, idempotencia por message ID, rechazo de cuentas no habilitadas y mensajes anteriores a activación.
- `arm-meta-webhook` v3: verifica HMAC SHA256 y usa la función atómica. Permanece fail-closed sin `ARM_META_VERIFY_TOKEN` y `ARM_META_APP_SECRET`.
- Prueba SQL transaccional con ROLLBACK: mensaje nuevo almacenado una vez; repetición => duplicate; cuenta extraña y mensaje antiguo => ignored. No quedaron registros de ensayo.

## Próximo paso para recepción
Evaluar una **derivación de eventos** desde el receptor actual `whatsapp.artos.pe` con verificación y autenticación de servidor a servidor, sin modificar su entrega principal. Si se decide usar Meta directamente para Facebook e Instagram, configurar sus suscripciones y secretos por app validada en un flujo separado.

No publicar, enviar, eliminar ni reasignar suscripciones de producción sin una prueba de extremo a extremo.
