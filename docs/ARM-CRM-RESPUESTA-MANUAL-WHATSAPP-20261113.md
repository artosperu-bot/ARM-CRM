# ARM-CRM: respuesta manual de WhatsApp (piloto privado)

## Problema corregido

Antes, **Tomar conversación** asignaba el hilo al asesor, pero la bandeja no tenía campo para escribir. El aviso incluso afirmaba que todas las respuestas manuales estaban deshabilitadas. Ahora, al estar asignada a la sesión, la conversación de WhatsApp muestra **Tu respuesta como asesor**, un cuadro de texto y el botón **Enviar por WhatsApp**.

La bandeja mantiene el historial de Supabase y lo actualiza periódicamente. El mensaje se guarda en `arm_messages` con el identificador `wamid` devuelto por Meta. La interfaz distingue aceptación en la API de entrega efectiva al teléfono.

## Controles de envío en servidor

- JWT Supabase vigente, usuario activo de STECH y acceso RLS al workspace.
- Conversación WhatsApp en estado `human`, asignada exactamente a ese usuario.
- Remitente autorizado: pertenencia a la lista privada de **dos números de prueba**; la cuenta origen debe corresponder al `WHATSAPP_PHONE_NUMBER_ID` configurado.
- Cliente sin `opt_out`; último mensaje entrante válido dentro de las 24 horas.
- El texto no puede estar vacío ni superar 800 caracteres.
- Identificador de solicitud único para no reenviar en reintentos; bloqueo adicional de mensajes idénticos repetidos dentro de ocho segundos.
- Credenciales de Meta y rol de servicio Supabase **solo en el backend local**, nunca en variables VITE, React ni GitHub.
- La recepción de webhooks firmados y la automatización de ALEX no cambian. ALEX no envía cuando el hilo está asignado al asesor.

## Qué significa el estado del mensaje

`HTTP 200` y un ID de Meta permiten afirmar «aceptado para procesamiento», **no «entregado» ni «leído»**. El historial muestra el texto enviado; las confirmaciones detalladas de entrega de mensajes manuales siguen siendo una mejora futura. Si Meta rechaza el envío, el servidor muestra un error y no registra un mensaje saliente inexistente.

## Validación

- Servicio de agente local disponible en `http://127.0.0.1:8789/health`; frontend en `http://127.0.0.1:5175/`.
- Ruta `GET /manual-whatsapp/status` y `POST /manual-whatsapp/send` responden **401** sin JWT válido.
- Verificación visual desde la Bandeja: asesor asignado, destinatario autorizado, ventana vigente y cuadro para escribir visibles.
- `server/whatsapp-manual-reply.test.mjs`: pruebas de aislamiento, ventana expirada, otra asignación, opt-out, destinatario no autorizado, rechazo de Meta, persistencia, idempotencia y no duplicación.
- Las pruebas no requieren envíos reales para aprobar. **El envío sucede únicamente al pulsar Enviar** por un usuario autenticado.

## Alcance y pendiente

Solo dos números piloto por ahora. Instagram, Messenger, campañas, plantillas fuera de ventana y seguimiento automático **no** están habilitados mediante este cuadro. El siguiente componente pendiente es almacenar y visualizar por `wamid` los estados de entrega y lectura de las respuestas manuales.

Archivos principales: `server/whatsapp-manual-reply.mjs`, `server/agent-server.mjs`, `src/features/inbox/InboxPage.tsx`, `src/features/inbox/useInbox.ts`, `src/features/inbox/inbox.css`.
