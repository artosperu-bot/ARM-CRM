# ALEX 2.0 — Motor de razonamiento comercial aplicado el 05/11/2026

## Estado de entrega
- Código desplegado y ejecutándose en PC020, commit `ac1db1d`.
- WhatsApp sandbox: firma Meta y allowlist de dos números, ingest duradero, agente con respuestas activas; no hay campañas ni mensajes de seguimiento salientes.
- Agente interno CRM: puerto 8789, autenticado y operativo. Panel puerto 5175 HTTP 200.
- `104/104` pruebas automáticas, typecheck y build aprobados.
- **No se ha hecho todavía una conversación real posterior al despliegue**; hay que comprobar UX en los dos teléfonos de prueba. La batería usa respuestas OpenAI simuladas, no garantiza resultado idéntico de un modelo real.

## Arquitectura de decisiones del agente
1. **Contexto de clientes** `server/buyer-reasoning.mjs`: extrae solo de mensajes del cliente cantidad de productos, presupuesto, si es total o unitario, marca, uso, producto mencionado, posible B2B e intención del último mensaje. Dato más reciente tiene prioridad. No procesa números de teléfono como presupuestos, ni 256 GB como unidades.
2. **Reglas comerciales** `server/sales-policy.mjs`: ALEX vende de manera conversacional, no exige cuestionarios rígidos ni revela puntuaciones. Consulta fuentes verificadas, no inventa garantías ni precios ni afirma una operación no confirmada.
3. **Generación OpenAI**: respuestas estructuradas en `gpt-5.4-mini`, `store:false`, sin modelos o servicios IA externos adicionales. Los filtros de clasificación son deterministas y no añaden tokens.
4. **Validador final** `server/sales-response-guard.mjs`: intercepta importes no respaldados por catálogo, descuentos no aprobados, cantidades exactas de almacén, promesas de entrega y acciones como "ya te agendé" que el backend no confirmó.
5. **Formato WhatsApp** `server/whatsapp-format.mjs`: muestra negritas y bloques claros, conserva la cantidad que quiere comprar el cliente, pero no muestra existencias exactas.
6. **Catálogo** `server/product-knowledge.mjs`: un precio real requiere fecha de verificación vigente (máximo seis horas en este piloto); datos de stock físico **nunca equivalen a disponibles para venta**. Simulación sigue aislada y marcada.
7. **CRM** `server/lead-intelligence.mjs`: la prioridad de compra ya no queda en alta cuando el último mensaje cancela la compra o se despide. El seguimiento sigue bloqueado y sujeto a consentimiento.

## Comportamientos esperados: ejemplos de pruebas
- "Necesito 3 laptops Lenovo para mi empresa, presupuesto S/ 12000 total" + "mejor 2": contexto final = dos equipos, presupuesto S/12000 total y posible B2B, sin volver a pedir esos datos.
- "Mi presupuesto es S/5000" + "lo subí a S/6200": conserva el último monto, nunca lo anuncia como precio del producto.
- "El Armor 22 ¿cuánto cuesta?" sin precio vigente: pide verificación; no inventa S/999 en modo real.
- "Ya no quiero comprar" después de una negociación: ALEX respeta la cancelación y la bandeja baja la prioridad.
- "Gracias por todo" después de una consulta: cierra cordialmente, sin volver a ofrecer menús.
- "Quiero hablar con un asesor": se detiene el bot a través de reglas del receptor y pasa a estado humano, sin prometer asignación inexistente.
- "Busco tres equipos": puede decir tres equipos; "tenemos 12 unidades en stock": no puede revelar existencias exactas.
- "Ya te agendé": no se permite sin transacción confirmada.

## Límites actuales y siguiente fase de lógica
1. **Memoria de larga duración** pendiente: se usa intención original más últimos 24 mensajes en WhatsApp (y últimos 10 turnos en CRM). Prioridad próxima: memoria estructurada persistente y revisable por cliente/oportunidad, con corrección de datos.
2. **Acciones transaccionales** pendientes: búsqueda ERP de ATP/precios vigentes, cotización con desglose y aprobaciones, oportunidades, tareas y confirmaciones ejecutadas por el backend con trazas. NO declarar realizados sin confirmación.
3. **Clasificación más compleja**: pasar de señales heurísticas a evaluación estructurada supervisada cuando haya corpus real y beneficio medible. No sustituir opt-out, restricciones de Meta ni permisos backend por decisiones de LLM.
4. **Pruebas E2E**: secuencias reales en WhatsApp con ambos números, presupuesto corregido, objeciones y solicitud humana, monitorear tokens, respuestas y tiempos.
5. **Mensajería duradera/outbox** sigue pendiente en Issue #2 para garantizar cero duplicaciones/reintentos bajo caída.

## Seguridad
- Nunca registrar ni enviar campañas fuera de los dos números Meta aprobados.
- No usar stock físico como disponible para prometer; verificar reservas y pedidos multicanal.
- Puntuación de lead es solo una heurística, no probabilidad.
- No exponer PII en perfiles estructurados; campos como teléfono/identidad no se extraen como hechos de venta.
- Cancelaciones, atención humana, baja y acciones no confirmadas tienen prioridad sobre conversiones comerciales.
