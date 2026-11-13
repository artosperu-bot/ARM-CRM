# ALEX — prueba interactiva Playwright dentro del CRM (07/11/2026)

## Objetivo

El asistente actúa como comprador, envía consultas por la interfaz auténtica de `http://127.0.0.1:5175/` usando STECH Playwright MCP, inspecciona la respuesta y el historial, y verifica la memoria en Supabase. No se envían mensajes de WhatsApp ni se crean pedidos, cobros o seguimiento.

## Incidencia de acceso resuelta antes de la prueba

Al iniciar desde la interfaz, la primera petición `POST http://127.0.0.1:8789/chat` devolvió 400 con mensaje de solicitud/conversación inválida. El cuerpo HTTP contenía un `workspaceId` UUID correcto, `conversationId:null` y mensaje válido de 186 caracteres. Se comprobó que la función de validación anterior tenía **seis segmentos UUID** en vez de cinco.

Corrección en `server/request-validation.mjs`, aplicada a `server/agent-server.mjs`; se añadieron 5 casos y se reinició únicamente el agente privado de puerto 8789. El servicio de WhatsApp no se reinició. Resultado: se crea una conversación real de CRM con persistencia.

## Conversación de laboratorio: seis turnos del comprador

| Turno | Consulta sintética | Resultado observado | Valoración |
|---|---|---|---|
| 1 | 3 Armor X13 para construcción, presupuesto total S/ 3,000 | Explica certificaciones y limitaciones, pero no retoma cantidad ni presupuesto en la primera respuesta | Parcial; respuesta técnica extensa y poco comercial |
| 2 | Cambio a 2; solicita recordar presupuesto y modelo | Recuerda S/ 3,000 total y Ulefone Armor X13 | Correcto |
| 3 | Pregunta precio total, cotización y descuento | No inventa cifra ni descuento; reitera presupuesto y modelo, pero ofrece volver a revisar opciones ya elegidas | Parcial; cierre débil |
| 4 | Confirma compra; pide pago, pedido y cotización | No inventa pedido, pago o enlace y explica bloqueo por precios/condiciones no verificados | Correcto en seguridad; sin transacción disponible |
| 5 | «Quiero que me atienda un asesor humano» | Solicitó nombre y teléfono para una supuesta derivación no ejecutada | **Fallo real detectado** |
| 6 | Tras corrección, recarga del CRM; reitera solicitud humana y pregunta si avisaron | No afirma traspaso; informa que no hay confirmación de asesor asignado; no vuelve a solicitar datos | Corregido |

La prueba fue ejecutada usando Playwright por la interfaz real, con usuario autenticado. Tras recargar la página, la conversación seguía en el lateral y sus mensajes se cargaron desde Supabase.

## Prueba de persistencia

Consulta directa a Supabase del hilo sintético confirmó:
- 12 mensajes `arm_agent_turns` (6 del cliente simulado y 6 del agente).
- `sales_memory.quantity = 2`
- `sales_memory.budget = {"pen":3000,"scope":"total"}`
- `sales_memory.selected_partnumber = "ARMOR-X13"`
- `sales_memory.requires_human = true`

## Soluciones implementadas

1. Validación UUID estándar en el endpoint privado de agente (5 pruebas).
2. Reconocimiento de variantes naturales de petición humana, como «quiero que me atienda un asesor humano» y «¿puedes comunicarme con alguien?» en razonamiento comercial y triage (2 pruebas).
3. Suite local PC020: **180/180 pruebas aprobadas** (22 archivos), build correcto.
4. No se ejecutó botón «Gestionar en CRM» para evitar oportunidades comerciales de prueba. No se enviaron WhatsApp; no hubo cotizaciones, pedidos ni pagos creados.

## Evaluación cualitativa

ALEX ya conserva cambios importantes y diferencia mejor intención, verificación y acción; sin embargo, no está listo para cerrar compras de forma autónoma. Dos debilidades pendientes son: (1) resolver una cotización real o un handoff efectivo, no solo declarar lo que falta; (2) respuestas más breves y dirigidas al objetivo, evitando volver a ofrecer comparaciones cuando el comprador ya decidió. Los tests automáticos no garantizan calidad comercial del lenguaje generado.

## Entorno

- PC020, rama `feat/stech-arm-crm-foundation-20261102`.
- Chat privado CRM, acceso local `http://127.0.0.1:5175/`.
- Agente privado puerto 8789 reiniciado tras corrección.
- Playwright MCP con sesión Chrome autorizada.
- Servicios de WhatsApp no modificados.
