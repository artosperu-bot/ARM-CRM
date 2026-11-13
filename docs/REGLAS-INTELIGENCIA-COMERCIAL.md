# STECH ARM-CRM — Inteligencia comercial, filtros y reglas (05/11/2026)

## Resultado real de esta entrega
- La clasificación ocurre después de un **webhook WhatsApp firmado**, cuenta + destinatario permitidos e ingesta en Supabase.
- Cada conversación de prueba obtiene una fila en \`public.arm_lead_insights\` con intención, prioridad, puntuación heurística, señales, posible B2B, cantidad mencionada, revisión humana y acción sugerida. El valor no es probabilidad de compra.
- \`src/features/inbox/InboxPage.tsx\`: filtros de **alta prioridad**, **empresas/2+ equipos**, **cotizaciones/compras**, **asesor** y **no contactar**, combinables con filtros de canal y búsqueda; muestra acción siguiente y marca PRUEBA.
- Código \`server/lead-intelligence.mjs\` + \`server/lead-intelligence-processor.mjs\`: reglas explicables sin llamadas OpenAI adicionales, sin servicios pagados adicionales.
- ALEX recibe el contexto de intención y posible B2B, pero debe corroborar: nunca afirmar que una empresa ya comprará, que un presupuesto está aceptado o que la oportunidad está ganada.
- El backend continúa usando solo OpenAI API para las respuestas de ALEX y datos reales/verificados para afirmaciones comerciales.

## Reglas de señales
| Señal | Efecto | Restricción |
| --- | --- | --- |
| Compra explícita (quiero comprar / dónde pago) | Eleva prioridad y recomienda facilitar la compra | No crea pedido, venta ni estado ganado |
| Cotización, precio, factura | Identifica cotización y solicita verificación comercial | No inventa precios ni envía cotización |
| Empresa/RUC o >=2 dispositivos mencionados | Marca posible B2B | Cantidad de memoria/almacenamiento no se confunde con unidades |
| Comparación o objeción | Recomienda explicar diferencias/beneficios comprobados | No inventa características ni ofrece descuentos |
| Urgencia / plazo | Eleva prioridad si hay un requerimiento comercial | No promete entrega |
| Quiero un asesor / reclamo | Atención humana; bloquea ALEX, puede marcar hilo 'human' | No asigna un responsable inexistente |
| No me escriban / baja | Guarda opt-out y deja de contestar | El opt-out persiste hasta autorización nueva explícita |
| Hilo cerrado o asignado | Suprime mensajes IA | Nunca responde en paralelo a un asesor |

La puntuación es una regla local de ordenación comercial (0–100), no una predicción estadística ni una garantía de conversión. Un asesor puede corregir y priorizar según contexto. El cálculo se basa en mensajes del cliente, no en promociones del propio bot ni en datos sensibles.

## Reglas críticas de ALEX
1. Responder primero la pregunta concreta y recordar datos ya suministrados.
2. No mencionar precio ni disponibilidad salvo que el cliente los consulte. Nunca mostrar unidades exactas de stock.
3. Características, IP68/IP69K/MIL-STD y comparativos solo con respaldo; no prometer resistencia absoluta, garantías o entregas no verificadas.
4. WhatsApp: negritas nativas, bloques cortos, beneficios relevantes, máximo una pregunta útil, sin menú rígido.
5. Reconocer incertidumbre de información real ERP y evitar usar datos simulados en ventas.
6. No anunciar cotizaciones, reservas, pedidos, citas, acciones o envíos sin confirmación real del backend.
7. Ceder el control al asesor cuando se solicite y nunca responder en paralelo.
8. Solo los dos destinatarios sandbox aprobados; no exponer llaves de Meta/OpenAI al navegador.
9. Mantener coste: clasificador determinístico sin llamadas extra, Responses API \`store:false\` para respuestas.

## Seguimientos: bloqueados a propósito
- \`followup_suppressed=true\` **siempre**, aun para prioridad alta o B2B.
- No existe consentimiento implícito por preguntar precio, querer comprar o escribir por WhatsApp.
- No hay envío automático programado, cadencia de 3 horas, llamadas ni campañas.
- Próxima fase: consentimiento explícito por canal, registro de autorización, quiet hours América/Lima, ventana WhatsApp de 24 h/plantillas aprobadas, cancelación por respuesta, humano, opt-out, cierre y deduplicación persistente. Solo entonces habilitar un scheduler.
- La agenda manual del CRM es interna y no promete un mensaje enviado al cliente.

## Sandbox frente a producción
- Todas las consultas del número **Meta de prueba** se etiquetan \`source_mode=sandbox\`, incluso si contienen intención explícita de compra o precio simulado.
- No se crean \`arm_deals\`, pedidos ni mensajes de seguimiento a partir de puntuaciones sandbox.
- El catálogo de prueba está aislado de los datos ERP verificados.
- La calificación histórica se aplicó solo a remitentes de prueba previamente autorizados, mediante \`server/backfill-lead-intelligence.mjs\`, sin modificar estados ni enviar mensajes.

## Seguridad y acceso
- \`arm_lead_insights\` tiene RLS habilitada; lectura solo para miembros u owner autenticados del workspace, escritura solo mediante servidor service-role.
- El frontend no recibe credenciales de servidor. No hay acceso anónimo a esta tabla.
- El evento de ingreso firmado debe persistirse antes de calificarlo; si falla el análisis, por seguridad no se genera respuesta automática para ese turno.
- Nuevos contactos no reciben un envío proactivo por el solo hecho de entrar al CRM.

## Alcance futuro, no terminado
- Evaluar lenguaje más complejo y polisemia mediante un clasificador estructurado bajo el mismo presupuesto de tokens, sin reemplazar controles determinísticos de seguridad.
- Integración real del ERP y tabla de equivalencias para PN, stock, precio y catálogo de todos los canales.
- Pipeline de oportunidades ligado a las señales, con auditoría de cambios y supervisión.
- Seguimientos autorizados y scheduler único, sin duplicidad entre n8n, CRM antiguo y ARM.
- Facebook, Instagram y web en un solo inbox y memoria por cliente.
- Autostart/recovery de PC020 y verificación E2E con nuevos mensajes reales.
