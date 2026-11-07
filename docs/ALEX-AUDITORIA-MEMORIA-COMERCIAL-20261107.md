# ALEX — continuación de auditoría y memoria comercial (07/11/2026)

## Alcance y evidencia
- Rama del PR #1: `feat/stech-arm-crm-foundation-20261102`.
- Nuevo módulo `server/sales-memory.mjs`: resumen comercial determinista, versionado, con cantidad, presupuesto, uso, marca, referencia y preferencia humana. No persiste texto libre, teléfonos, DNI ni afirmaciones generadas por IA.
- `server/buyer-reasoning.mjs`: acepta memoria anterior, revalida SKU frente al catálogo actual, respeta correcciones y descarta identificaciones anteriores ante cambio claro de producto o marca.
- `server/lead-intelligence-processor.mjs`: guarda memoria en `arm_lead_insights` tras la ingesta firmada y autorizada. Para conversaciones antiguas, reconstruye una vez hasta 200 mensajes entrantes; luego funciona incrementalmente.
- `server/whatsapp-test-responder.mjs`: utiliza memoria comercial del hilo y devuelve una versión depurada de la identificación del producto. No habilita mensajes proactivos, cotización ni pedidos; mantiene comprobación de atención humana y baja antes de enviar.
- `server/agent-server.mjs`: memoria aislada por conversación interna y propietario, con carga inicial de hasta 200 mensajes propios si la conversación antecede esta mejora.
- Migración `supabase/migrations/20261107_arm_sales_memory.sql` aplicada en Supabase ARM (iipamvqbipbolchlozoj): `sales_memory jsonb` en `arm_agent_conversations` y `arm_lead_insights`, validación de tamaño/objeto, RLS para conversaciones privadas y permiso UPDATE limitado a memoria; `arm_lead_insights` continúa sin UPDATE de `authenticated`. Se consultaron columnas y permisos después de aplicar.

## Auditorías reales sintéticas (sin WhatsApp y sin escrituras)
Se ejecutó `server/audit-real-dialogues.mjs` desde PC020 con la API de OpenAI, con historial preservado, revisando turnos del cliente y respuesta final tras guardas.
- MEMORIA_COTIZACION: cliente pasa de tres a dos laptops, conserva presupuesto y uso; ALEX inicialmente insinuaba preparar referencias no creadas. Se corrigió; posteriormente responde que no se ha generado cotización y faltan precios verificados.
- CAMBIO_MODELO_DESCONOCIDO: pasa de Ulefone a Brother HL-L2340; el producto anterior se invalida y no se da un precio cruzado. ALEX inicialmente solicitó de nuevo un código completo; se agregó protección permanente.
- ASESOR_PERSISTENTE: la solicitud humana permanece entre turnos y no se inventa notificación.
- DECISION_COMPRAR: se detectaron frases de falsa gestión como «dejar listo el contacto» y «te indico el canal de pago» sin checkout. Se añadieron guardas y pruebas para ambas.
- En las rondas ejecutadas: `META_SENT=0`, `CRM_WRITES=0` (simulaciones únicamente). El comportamiento estocástico del modelo exige revisión continua, no significa infalibilidad.

## Verificaciones
- PC020 local: `git pull --ff-only` hasta commit `efc1690`, `npm run typecheck`, `npm test` y `npm run build` completados.
- **173/173 pruebas** en 21 archivos. Las nuevas pruebas cubren memoria, cambios de referencia, baja/asesor, precios cruzados y compromisos comerciales inexistentes.
- Meta gateway y agente interno verificaron `/health` antes de la actualización del código local. **No se reiniciaron sus procesos ni se envió WhatsApp.** Por tanto, el código queda disponible en disco, pero no se declara recarga de runtime/despliegue del servidor.
- No se han modificado DB_ST, PC005, ni datos comerciales del ERP. No hay pedidos, cotizaciones ni contactos humanos creados por el QA.

## Próximo umbral para activar en sandbox
1. Probar actualización de memoria en DB con una conversación autenticada de prueba y verificar RLS con dos identidades.
2. Reiniciar servicios de manera controlada, validar PID/HEAD y `/health` y probar mensajes entrantes desde dos números autorizados con exclusión estricta de clientes.
3. Completar outbox durable / idempotencia de envío, señalización real a asesor, pricing y stock vendible antes de habilitar cotizaciones o cobros.
4. Evolucionar evaluación cualitativa con lenguaje peruano real, objeciones, alternativas y respuestas comerciales medibles.

## Seguridad adicional observada
El asesor de Supabase también reporta avisos históricos de vistas SECURITY DEFINER y tablas ajenas a esta migración; no se alteraron objetos heredados sin un análisis independiente. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
